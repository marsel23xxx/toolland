//! WHOIS lewat RDAP (pengganti resmi WHOIS port 43, jawaban JSON).
//! Server RDAP tiap TLD diambil dari daftar IANA, hasil disimpan di memori 1 jam
//! supaya registry tidak dibanjiri permintaan yang sama. Nama domain tidak dicatat di log.

use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use serde::Serialize;
use serde_json::Value;

use crate::error::{ApiError, ApiResult};

const CACHE_TTL: Duration = Duration::from_secs(60 * 60);
const BOOTSTRAP_TTL: Duration = Duration::from_secs(24 * 60 * 60);
const CACHE_MAX: usize = 2000;
/// Jawaban RDAP normal hanya beberapa KB; lebih dari ini dianggap tidak wajar.
const MAX_BODY: usize = 512 * 1024;
/// Maksimal permintaan ke registry per pencarian (www.contoh.co.id -> contoh.co.id).
const MAX_TRIES: usize = 3;

#[derive(Clone, Debug, Default, Serialize, PartialEq)]
pub struct Registrar {
    pub name: Option<String>,
    pub url: Option<String>,
    pub iana_id: Option<String>,
    pub abuse_email: Option<String>,
    pub abuse_phone: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, PartialEq)]
pub struct Registrant {
    pub organization: Option<String>,
    pub country: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, PartialEq)]
pub struct WhoisInfo {
    pub domain: String,
    pub unicode_name: Option<String>,
    pub registered: Option<String>,
    pub expires: Option<String>,
    pub updated: Option<String>,
    pub status: Vec<String>,
    pub nameservers: Vec<String>,
    pub dnssec: Option<bool>,
    pub registrar: Option<Registrar>,
    pub registrant: Option<Registrant>,
    /// Alamat RDAP yang dipakai, supaya pengguna bisa cek sendiri.
    pub source: String,
}

/// Peta TLD -> URL dasar RDAP.
type Servers = Arc<HashMap<String, String>>;

type Cached = (Instant, Result<Arc<WhoisInfo>, CachedError>);

#[derive(Clone, Copy)]
enum CachedError {
    NotFound,
    NoRdap,
}

pub struct Rdap {
    http: reqwest::Client,
    bootstrap_url: String,
    bootstrap: Mutex<Option<(Instant, Servers)>>,
    cache: Mutex<HashMap<String, Cached>>,
}

impl Rdap {
    pub fn new(bootstrap_url: String) -> anyhow::Result<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .user_agent(concat!("Toolland-WHOIS/", env!("CARGO_PKG_VERSION")))
            // Registry kadang mengalihkan ke server lain; dibatasi dan wajib HTTPS.
            .redirect(reqwest::redirect::Policy::custom(|a| {
                if a.previous().len() >= 3 || a.url().scheme() != "https" {
                    a.stop()
                } else {
                    a.follow()
                }
            }))
            .build()?;
        Ok(Self {
            http,
            bootstrap_url,
            bootstrap: Mutex::new(None),
            cache: Mutex::new(HashMap::new()),
        })
    }

    pub async fn lookup(&self, domain: &str) -> ApiResult<Arc<WhoisInfo>> {
        if let Some(hit) = self.cached(domain) {
            return hit;
        }
        let result = self.fetch(domain).await;
        let to_cache = match &result {
            Ok(info) => Some(Ok(info.clone())),
            Err(ApiError::NotFound) => Some(Err(CachedError::NotFound)),
            Err(ApiError::NoRdap) => Some(Err(CachedError::NoRdap)),
            // Error sementara (timeout, registry down) tidak disimpan.
            Err(_) => None,
        };
        if let Some(v) = to_cache {
            let mut cache = self.cache.lock().unwrap();
            if cache.len() >= CACHE_MAX {
                cache.retain(|_, (t, _)| t.elapsed() < CACHE_TTL);
                if cache.len() >= CACHE_MAX {
                    cache.clear();
                }
            }
            cache.insert(domain.to_owned(), (Instant::now(), v));
        }
        result
    }

    fn cached(&self, domain: &str) -> Option<ApiResult<Arc<WhoisInfo>>> {
        let cache = self.cache.lock().unwrap();
        let (at, v) = cache.get(domain)?;
        if at.elapsed() >= CACHE_TTL {
            return None;
        }
        Some(match v {
            Ok(info) => Ok(info.clone()),
            Err(CachedError::NotFound) => Err(ApiError::NotFound),
            Err(CachedError::NoRdap) => Err(ApiError::NoRdap),
        })
    }

    async fn fetch(&self, domain: &str) -> ApiResult<Arc<WhoisInfo>> {
        let tld = domain.rsplit('.').next().unwrap_or_default();
        let base = self
            .servers()
            .await?
            .get(tld)
            .cloned()
            .ok_or(ApiError::NoRdap)?;

        // Subdomain tidak terdaftar di registry: coba www.contoh.co.id, lalu contoh.co.id.
        let labels: Vec<&str> = domain.split('.').collect();
        for start in 0..labels.len().saturating_sub(1).min(MAX_TRIES) {
            let name = labels[start..].join(".");
            let url = format!("{base}domain/{name}");
            match self.get_json(&url).await? {
                Some(json) => return Ok(Arc::new(parse(&json, &name, &url))),
                None => continue,
            }
        }
        Err(ApiError::NotFound)
    }

    /// Peta TLD -> URL dasar RDAP (berakhiran "/"), diperbarui sehari sekali.
    async fn servers(&self) -> ApiResult<Servers> {
        if let Some((at, map)) = &*self.bootstrap.lock().unwrap()
            && at.elapsed() < BOOTSTRAP_TTL
        {
            return Ok(map.clone());
        }
        let json = self
            .get_json(&self.bootstrap_url)
            .await?
            .ok_or(ApiError::Upstream)?;
        let map = Arc::new(parse_bootstrap(&json));
        if map.is_empty() {
            return Err(ApiError::Upstream);
        }
        *self.bootstrap.lock().unwrap() = Some((Instant::now(), map.clone()));
        Ok(map)
    }

    /// GET JSON; `None` bila 404 (domain tidak ada).
    async fn get_json(&self, url: &str) -> ApiResult<Option<Value>> {
        let mut resp = self
            .http
            .get(url)
            .header("accept", "application/rdap+json, application/json")
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    ApiError::Timeout
                } else {
                    ApiError::Upstream
                }
            })?;
        match resp.status().as_u16() {
            200 => {}
            404 => return Ok(None),
            429 => return Err(ApiError::Busy),
            _ => return Err(ApiError::Upstream),
        }
        let mut body = Vec::new();
        while let Some(chunk) = resp.chunk().await.map_err(|_| ApiError::Upstream)? {
            body.extend_from_slice(&chunk);
            if body.len() > MAX_BODY {
                return Err(ApiError::Upstream);
            }
        }
        serde_json::from_slice(&body)
            .map(Some)
            .map_err(|_| ApiError::Upstream)
    }
}

/// Rapikan input jadi nama domain ASCII (IDN sudah diubah ke punycode oleh browser).
pub fn normalize(input: &str) -> Option<String> {
    let d = input.trim().trim_end_matches('.').to_ascii_lowercase();
    if d.is_empty() || d.len() > 253 || !d.is_ascii() {
        return None;
    }
    let labels: Vec<&str> = d.split('.').collect();
    if labels.len() < 2 {
        return None;
    }
    let label_ok = |l: &&str| {
        !l.is_empty()
            && l.len() <= 63
            && !l.starts_with('-')
            && !l.ends_with('-')
            && l.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
    };
    if !labels.iter().all(label_ok) {
        return None;
    }
    // TLD berupa huruf atau punycode (xn--), bukan angka (cegah alamat IP).
    let tld = labels[labels.len() - 1];
    if !(tld.starts_with("xn--") || tld.bytes().all(|b| b.is_ascii_alphabetic())) {
        return None;
    }
    Some(d)
}

fn parse_bootstrap(json: &Value) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for service in json["services"].as_array().into_iter().flatten() {
        let (Some(tlds), Some(urls)) = (service[0].as_array(), service[1].as_array()) else {
            continue;
        };
        let urls: Vec<&str> = urls.iter().filter_map(Value::as_str).collect();
        let Some(url) = urls
            .iter()
            .find(|u| u.starts_with("https://"))
            .or(urls.first())
        else {
            continue;
        };
        let url = if url.ends_with('/') {
            (*url).to_owned()
        } else {
            format!("{url}/")
        };
        for tld in tlds.iter().filter_map(Value::as_str) {
            map.insert(tld.to_ascii_lowercase(), url.clone());
        }
    }
    map
}

fn str_of(v: &Value) -> Option<String> {
    v.as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
}

/// Ambil satu properti vCard (jCard): ["vcard", [["fn", {}, "text", "Nama"], ...]].
fn vcard<'a>(entity: &'a Value, prop: &str) -> Option<&'a Value> {
    entity["vcardArray"][1]
        .as_array()?
        .iter()
        .find(|p| p[0].as_str() == Some(prop))
}

fn vcard_text(entity: &Value, prop: &str) -> Option<String> {
    let p = vcard(entity, prop)?;
    match &p[3] {
        Value::Array(parts) => {
            let joined = parts
                .iter()
                .filter_map(Value::as_str)
                .filter(|s| !s.is_empty())
                .collect::<Vec<_>>()
                .join(" ");
            str_of(&Value::String(joined))
        }
        v => str_of(v),
    }
}

fn has_role(entity: &Value, role: &str) -> bool {
    entity["roles"]
        .as_array()
        .is_some_and(|r| r.iter().any(|x| x.as_str() == Some(role)))
}

fn entities(v: &Value) -> impl Iterator<Item = &Value> {
    v["entities"].as_array().into_iter().flatten()
}

/// Data yang disembunyikan registry (GDPR) tidak ditampilkan sebagai nama asli.
fn visible(s: Option<String>) -> Option<String> {
    s.filter(|s| {
        let l = s.to_ascii_lowercase();
        !(l.contains("redacted")
            || l.contains("privacy")
            || l.contains("not disclosed")
            || l.contains("withheld")
            || l.contains("data protected"))
    })
}

pub fn parse(json: &Value, name: &str, source: &str) -> WhoisInfo {
    let event = |action: &str| {
        json["events"]
            .as_array()?
            .iter()
            .find(|e| e["eventAction"].as_str() == Some(action))
            .and_then(|e| str_of(&e["eventDate"]))
    };

    let registrar = entities(json).find(|e| has_role(e, "registrar")).map(|e| {
        let abuse = entities(e).find(|a| has_role(a, "abuse"));
        let tel = abuse
            .and_then(|a| vcard_text(a, "tel"))
            .map(|t| t.trim_start_matches("tel:").to_owned());
        Registrar {
            name: vcard_text(e, "fn").or_else(|| vcard_text(e, "org")),
            url: vcard_text(e, "url").or_else(|| {
                e["links"]
                    .as_array()?
                    .iter()
                    .find(|l| l["rel"].as_str() == Some("about"))
                    .and_then(|l| str_of(&l["href"]))
            }),
            iana_id: e["publicIds"]
                .as_array()
                .into_iter()
                .flatten()
                .find(|p| p["type"].as_str().is_some_and(|t| t.contains("IANA")))
                .and_then(|p| str_of(&p["identifier"])),
            abuse_email: abuse.and_then(|a| vcard_text(a, "email")),
            abuse_phone: tel,
        }
    });

    let registrant = entities(json)
        .find(|e| has_role(e, "registrant"))
        .and_then(|e| {
            let organization =
                visible(vcard_text(e, "org")).or_else(|| visible(vcard_text(e, "fn")));
            let adr = vcard(e, "adr");
            let country = adr
                .and_then(|a| str_of(&a[1]["cc"]))
                .or_else(|| adr.and_then(|a| str_of(&a[3][6])));
            let country = visible(country);
            (organization.is_some() || country.is_some()).then_some(Registrant {
                organization,
                country,
            })
        });

    let mut nameservers: Vec<String> = json["nameservers"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|n| str_of(&n["ldhName"]))
        .map(|n| n.to_ascii_lowercase().trim_end_matches('.').to_owned())
        .collect();
    nameservers.dedup();

    WhoisInfo {
        domain: str_of(&json["ldhName"])
            .map(|n| n.to_ascii_lowercase())
            .unwrap_or_else(|| name.to_owned()),
        unicode_name: str_of(&json["unicodeName"]),
        registered: event("registration"),
        expires: event("expiration"),
        updated: event("last changed"),
        status: json["status"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(str_of)
            .collect(),
        nameservers,
        dnssec: json["secureDNS"]["delegationSigned"].as_bool(),
        registrar,
        registrant,
        source: source.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalisasi_domain() {
        assert_eq!(
            normalize(" Contoh.CO.id. ").as_deref(),
            Some("contoh.co.id")
        );
        assert_eq!(
            normalize("xn--mgbh0fb.xn--kgbechtv").as_deref(),
            Some("xn--mgbh0fb.xn--kgbechtv")
        );
        for bad in [
            "",
            "localhost",
            "192.168.1.1",
            "-a.com",
            "a..com",
            "a_b.com",
            "a.com/x",
            "é.com",
        ] {
            assert_eq!(normalize(bad), None, "{bad}");
        }
    }

    #[test]
    fn bootstrap_iana() {
        let json = serde_json::json!({"services": [
            [["com", "net"], ["http://rdap.contoh/com/v1/", "https://rdap.contoh/com/v1/"]],
            [["ID"], ["https://rdap.pandi.id/rdap"]]
        ]});
        let map = parse_bootstrap(&json);
        assert_eq!(map["net"], "https://rdap.contoh/com/v1/");
        assert_eq!(map["id"], "https://rdap.pandi.id/rdap/");
    }

    #[test]
    fn data_tersembunyi_tidak_ditampilkan() {
        let json = serde_json::json!({
            "ldhName": "CONTOH.COM",
            "entities": [{
                "roles": ["registrant"],
                "vcardArray": ["vcard", [["fn", {}, "text", "REDACTED FOR PRIVACY"],
                    ["adr", {"cc": "ID"}, "text", ["", "", "", "", "", "", ""]]]]
            }]
        });
        let info = parse(&json, "contoh.com", "x");
        assert_eq!(info.domain, "contoh.com");
        let r = info.registrant.unwrap();
        assert_eq!(r.organization, None);
        assert_eq!(r.country.as_deref(), Some("ID"));
    }
}

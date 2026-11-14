/** Semua tes kepribadian dalam satu tipe, untuk komponen PersonalityTest. */
import { bigFiveProfile, type BigFiveTest } from './bigfive';
import type { DiscAnswer, Profile } from './core';
import { discProfile, type DiscTest } from './disc';
import { riasecProfile, type RiasecTest } from './riasec';
import { types16Profile, type Types16Test } from './types16';

export type LikertTest = BigFiveTest | Types16Test | RiasecTest;
export type PersonalityTest = LikertTest | DiscTest;

/** Jawaban: angka 1-5 per pernyataan (Likert) atau pilihan paling/paling tidak (DISC). */
export type Answers = (number | null)[] | DiscAnswer[];

export function questionCount(test: PersonalityTest): number {
  return test.type === 'disc' ? test.groups.length : test.items.length;
}

export function isComplete(test: PersonalityTest, answers: Answers): boolean {
  if (answers.length !== questionCount(test)) return false;
  return test.type === 'disc'
    ? (answers as DiscAnswer[]).every((a) => a && a.most != null && a.least != null)
    : (answers as (number | null)[]).every((a) => a != null);
}

export function profileOf(test: PersonalityTest, answers: Answers): Profile {
  switch (test.type) {
    case 'bigfive':
      return bigFiveProfile(test, answers as (number | null)[]);
    case 'types16':
      return types16Profile(test, answers as (number | null)[]);
    case 'riasec':
      return riasecProfile(test, answers as (number | null)[]);
    case 'disc':
      return discProfile(test, answers as DiscAnswer[]);
  }
}

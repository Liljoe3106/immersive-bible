export type ReadMode = 'en' | 'gap' | 'orig'

export interface OrigWord {
  t: string
  s: string
  m: string
  l?: string
}

export type EnglishChapter = string[]
export type OrigChapter = OrigWord[][]

export interface Place {
  book: string
  chapter: number
  verse?: number
}

export interface StrongEntry {
  lemma: string
  xlit: string
  strongs_def: string
  kjv_def: string
  der?: string
}

export type SearchHit = [string, number, number, string]

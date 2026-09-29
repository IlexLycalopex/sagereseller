import raw from '../data/selector.rules.json';
import type { Rules } from './scoring';

export const rules = raw as unknown as Rules;

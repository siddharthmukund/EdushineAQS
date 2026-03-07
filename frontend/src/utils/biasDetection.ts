/**
 * Bias Detection and Anonymization Utilities
 * 
 * Implements three-layer bias mitigation:
 * 1. Pre-scoring anonymization
 * 2. Post-scoring bias detection
 * 3. Visual bias alerts
 */

export interface BiasFlag {
  type: 'institution_bias' | 'career_gap_penalty' | 'non_traditional_path' | 'name_bias' | 'gender_bias';
  severity: 'low' | 'medium' | 'high';
  message: string;
  suggestion: string;
}

/**
 * Layer 1: Pre-Scoring Anonymization
 * Removes personally identifiable information to reduce unconscious bias
 */
export function anonymizeCV(text: string): string {
  let anonymized = text;
  
  // Replace common Indian names with "Candidate"
  const indianNames = [
    'Kumar', 'Singh', 'Sharma', 'Patel', 'Gupta', 'Reddy', 'Rao', 
    'Das', 'Mehta', 'Joshi', 'Verma', 'Agarwal', 'Pandey', 'Mishra',
    'Nair', 'Iyer', 'Menon', 'Pillai', 'Khan', 'Ahmed', 'Ali'
  ];
  
  const namePattern = new RegExp(`\\b(${indianNames.join('|')})\\b`, 'gi');
  anonymized = anonymized.replace(namePattern, 'Candidate');
  
  // Remove titles
  anonymized = anonymized
    .replace(/\b(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.|Miss)\b/gi, '')
    .replace(/\b(Doctor|Professor)\b/gi, '');
  
  // Remove gender pronouns
  anonymized = anonymized
    .replace(/\b(he|she|his|her|him|himself|herself)\b/gi, (match) => {
      const lower = match.toLowerCase();
      if (lower === 'he' || lower === 'she') return 'they';
      if (lower === 'his' || lower === 'her') return 'their';
      if (lower === 'him') return 'them';
      if (lower === 'himself' || lower === 'herself') return 'themselves';
      return match;
    });
  
  // Remove photo markers
  anonymized = anonymized.replace(/\[PHOTO\]/gi, '');
  anonymized = anonymized.replace(/\(Photo\)/gi, '');
  
  return anonymized;
}

/**
 * Layer 2: Post-Scoring Bias Detection
 * Identifies potential biases in the scoring results
 */
export function detectBias(
  scores: { overall_aqs: number; research: number; education: number; teaching: number },
  originalText: string
): BiasFlag[] {
  const flags: BiasFlag[] = [];
  
  // Check 1: Institution prestige bias
  const prestigeInstitutionPattern = /\b(IIT|IIM|AIIMS|TIFR|ISI|IISC|Delhi University|Jawaharlal Nehru University|JNU)\b/i;
  const hasPrestigeInstitution = prestigeInstitutionPattern.test(originalText);
  
  if (hasPrestigeInstitution && scores.education > 85 && scores.research < 60) {
    flags.push({
      type: 'institution_bias',
      severity: 'medium',
      message: 'Education score may be inflated by institution prestige.',
      suggestion: 'Verify research output independently. Strong institution ≠ strong research.'
    });
  }
  
  // Check 2: Career gap penalty detection
  const careerGapPattern = /\b(gap|break|sabbatical|maternity|paternity|career break|gap year|leave)\b/i;
  const hasCareerGap = careerGapPattern.test(originalText);
  
  if (hasCareerGap && scores.overall_aqs < 70) {
    flags.push({
      type: 'career_gap_penalty',
      severity: 'high',
      message: 'Career gap detected. Ensure no unfair penalty is applied.',
      suggestion: 'Review teaching/research continuity in context. Career breaks are valid.'
    });
  }
  
  // Check 3: Non-traditional path detection
  const industryPattern = /\b(industry|corporate|startup|business|consulting|private sector)\b/i;
  const hasIndustryBackground = industryPattern.test(originalText);
  
  if (hasIndustryBackground && scores.teaching < 50) {
    flags.push({
      type: 'non_traditional_path',
      severity: 'low',
      message: 'Industry background may lack traditional teaching metrics.',
      suggestion: 'Consider practitioner value for applied courses. Industry experience is valuable.'
    });
  }
  
  // Check 4: Name bias (if original text contains names)
  const hasIndianName = /\b(Kumar|Singh|Sharma|Patel|Khan|Ahmed)\b/i.test(originalText);
  if (hasIndianName && scores.overall_aqs < 75) {
    flags.push({
      type: 'name_bias',
      severity: 'medium',
      message: 'Candidate has identifiable name. Consider enabling anonymization.',
      suggestion: 'Enable anonymization to reduce unconscious name-based bias.'
    });
  }
  
  // Check 5: Gender bias (if pronouns present)
  const hasFemalePronouns = /\b(she|her|herself|Ms\.|Mrs\.)\b/i.test(originalText);
  const hasMalePronouns = /\b(he|his|himself|Mr\.)\b/i.test(originalText);
  
  if ((hasFemalePronouns || hasMalePronouns) && Math.abs(scores.research - scores.teaching) > 30) {
    flags.push({
      type: 'gender_bias',
      severity: 'medium',
      message: 'Large gap between research and teaching scores with gender markers present.',
      suggestion: 'Review scoring for potential gender stereotyping (teaching vs. research roles).'
    });
  }
  
  return flags;
}

/**
 * Get severity color for UI display
 */
export function getSeverityColor(severity: BiasFlag['severity']): string {
  switch (severity) {
    case 'high':
      return 'text-red-700 bg-red-100 border-red-300';
    case 'medium':
      return 'text-yellow-700 bg-yellow-100 border-yellow-300';
    case 'low':
      return 'text-blue-700 bg-blue-100 border-blue-300';
    default:
      return 'text-gray-700 bg-gray-100 border-gray-300';
  }
}

/**
 * Get severity icon
 */
export function getSeverityIcon(severity: BiasFlag['severity']): string {
  switch (severity) {
    case 'high':
      return '🚨';
    case 'medium':
      return '⚠️';
    case 'low':
      return 'ℹ️';
    default:
      return '❓';
  }
}

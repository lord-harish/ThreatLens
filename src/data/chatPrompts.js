export const PRESET_PROMPTS = [
  {
    title: 'Critical findings',
    prompt: 'Which critical or high-severity vulnerabilities are documented in the indexed reports?',
    category: 'Finding Review',
  },
  {
    title: 'Unresolved issues',
    prompt: 'Which findings are explicitly described as unresolved in the audit evidence?',
    category: 'Status Review',
  },
  {
    title: 'Affected systems',
    prompt: 'Which systems or assets are named in the indexed audit reports?',
    category: 'Asset Scope',
  },
  {
    title: 'Compare reports',
    prompt: 'Which security issues recur or conflict across the indexed audit reports?',
    category: 'Cross-Report Review',
  },
];

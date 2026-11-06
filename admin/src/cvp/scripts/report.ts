import type { Comparison } from '../build'

/** Prints how two build outputs differ; true when they are the same */
export function reportComparison(comparison: Comparison): boolean {
  const { same, different, onlyInA, onlyInB } = comparison
  const ok = !different.length && !onlyInA.length && !onlyInB.length
  if (ok) {
    console.log(`✓ HTML: all ${same} built files byte-identical.`)
    return true
  }
  console.log(`✗ HTML: ${same} identical, ${different.length} different, ${onlyInA.length} missing, ${onlyInB.length} extra.`)
  for (const file of different.slice(0, 20)) console.log(`  different: ${file}`)
  for (const file of onlyInA.slice(0, 20)) console.log(`  missing:   ${file}`)
  for (const file of onlyInB.slice(0, 20)) console.log(`  extra:     ${file}`)
  return false
}

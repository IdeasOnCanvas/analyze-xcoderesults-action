#!/usr/bin/env node

import * as xcresulttool from './xcresulttool'
import * as path from 'path'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.log(`
Usage: npx ts-node src/cli.ts <xcresult-path> [command]

Commands:
  analyze     - Full analysis with summary and annotations (default)
  summary     - Just the markdown summary
  metrics     - Raw metrics JSON
  conclusion  - success/failure determination
  annotations - GitHub annotations JSON

Examples:
  npx ts-node src/cli.ts ./TestResults.xcresult
  npx ts-node src/cli.ts ./TestResults.xcresult summary
  npx ts-node src/cli.ts ./TestResults.xcresult metrics
`)
    process.exit(1)
  }

  const xcresultPath = path.resolve(args[0])
  const command = args[1] || 'analyze'

  try {
    const settings = new xcresulttool.GenerationSettings()
    // Set defaults for CLI usage
    settings.buildSummaryTable = true
    settings.testSummaryTable = true
    settings.testFailureAnnotations = true
    settings.summary = true
    settings.warningAnnotations = true // Show warnings in CLI
    settings.errorAnnotations = true
    settings.showSDKInfo = false
    settings.timingSummary = false

    switch (command) {
      case 'analyze':
        console.log('🔍 Analyzing xcresult bundle...\n')
        const data = await xcresulttool.analyzeXcResult(xcresultPath)
        const metrics = xcresulttool.extractMetrics(data)
        const summary = xcresulttool.generateSummary(data, settings)
        const annotations = xcresulttool.generateAnnotations(data, settings)
        const conclusion = xcresulttool.determineConclusion(data)

        console.log(`📊 **Metrics:**`)
        console.log(
          `   Tests: ${metrics.testsPassed}/${metrics.testsTotal} passed`
        )
        console.log(`   Errors: ${metrics.errors}`)
        console.log(`   Warnings: ${metrics.warnings}`)
        console.log(`   Overall: ${conclusion}\n`)

        if (summary) {
          console.log(summary)
        }

        if (annotations.length > 0) {
          console.log(`\n🚨 **Annotations (${annotations.length}):**`)
          annotations.forEach((ann, i) => {
            console.log(
              `${i + 1}. [${ann.annotation_level.toUpperCase()}] ${ann.title}`
            )
            console.log(`   ${ann.path}:${ann.start_line} - ${ann.message}`)
          })
        }
        break

      case 'summary':
        const summaryData = await xcresulttool.analyzeXcResult(xcresultPath)
        const summaryMarkdown = xcresulttool.generateSummary(
          summaryData,
          settings
        )
        console.log(summaryMarkdown)
        break

      case 'metrics':
        const metricsData = await xcresulttool.analyzeXcResult(xcresultPath)
        const rawMetrics = xcresulttool.extractMetrics(metricsData)
        console.log(JSON.stringify(rawMetrics, null, 2))
        break

      case 'conclusion':
        const conclusionData = await xcresulttool.analyzeXcResult(xcresultPath)
        const result = xcresulttool.determineConclusion(conclusionData)
        console.log(result)
        break

      case 'annotations':
        const annotationData = await xcresulttool.analyzeXcResult(xcresultPath)
        const allAnnotations = xcresulttool.generateAnnotations(
          annotationData,
          settings
        )
        console.log(JSON.stringify(allAnnotations, null, 2))
        break

      default:
        console.error(`Unknown command: ${command}`)
        process.exit(1)
    }
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : String(error)
    )
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

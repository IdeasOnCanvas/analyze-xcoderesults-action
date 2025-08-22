import * as core from '@actions/core'
import * as exec from '@actions/exec'
import {ExecOptions} from '@actions/exec/lib/interfaces'

export type Annotations = {
  path: string
  start_line: number
  end_line: number
  start_column?: number
  end_column?: number
  annotation_level: 'notice' | 'warning' | 'failure'
  message: string
  title: string
  raw_details?: string
}[]

// Modern, simplified interfaces that match the actual xcresulttool output
export interface BuildResults {
  actionTitle?: string
  analyzerWarningCount?: number
  analyzerWarnings?: unknown[]
  destination?: unknown
  endTime?: number
  errorCount?: number
  errors?: {
    className?: string
    issueType?: string
    message?: string
    sourceURL?: string
  }[]
  startTime?: number
  status?: string
  warningCount?: number
  warnings?: {
    className?: string
    issueType?: string
    message?: string
    sourceURL?: string
  }[]
}

export interface TestResults {
  devicesAndConfigurations?: unknown[]
  environmentDescription?: string
  expectedFailures?: number
  failedTests?: number
  finishTime?: number
  passedTests?: number
  result?: string
  skippedTests?: number
  startTime?: number
  testFailures?: {
    failureText?: string
    targetName?: string
    testIdentifier?: number
    testIdentifierString?: string
    testName?: string
  }[]
  title?: string
  topInsights?: unknown[]
  totalTestCount?: number
}

// New interfaces for detailed test results
export interface TestResultsDetailed {
  devices: {
    deviceId: string
    deviceName: string
    architecture: string
    modelName: string
    platform: string
    osVersion: string
    osBuildNumber?: string
  }[]
  testNodes: TestNode[]
  testPlanConfigurations: {
    configurationId: string
    configurationName: string
  }[]
}

export interface TestNode {
  nodeIdentifier?: string
  nodeType: string
  name: string
  details?: string
  duration?: string
  durationInSeconds?: number
  result?: string
  tags?: string[]
  children?: TestNode[]
}

export interface TestFailureWithLocation {
  testName: string
  targetName: string
  failureText: string
  sourceFile?: string
  lineNumber?: number
}

// Simplified results interface
export interface XcResultData {
  buildResults?: BuildResults
  testResults?: TestResults
  testResultsDetailed?: TestResultsDetailed
}

// Simplified metrics interface
export interface Metrics {
  testsTotal: number
  testsFailed: number
  testsPassed: number
  warnings: number
  errors: number
}

// GitHub annotation interface (no change needed)
export interface GitHubAnnotation {
  path: string
  start_line: number
  end_line: number
  start_column?: number
  end_column?: number
  annotation_level: 'notice' | 'warning' | 'failure'
  message: string
  title: string
  raw_details?: string
}

export class GenerationSettings {
  buildSummaryTable = true
  testSummaryTable = true
  testFailureAnnotations = true
  summary = true
  warningAnnotations = true
  errorAnnotations = true
  showSDKInfo = true
  timingSummary = true

  readActionSettings(): void {
    this.buildSummaryTable = core.getInput('buildSummaryTable') === 'true'
    this.testSummaryTable = core.getInput('testSummaryTable') === 'true'
    this.testFailureAnnotations =
      core.getInput('testFailureAnnotations') === 'true'
    this.summary = core.getInput('summary') === 'true'
    this.warningAnnotations = core.getInput('warningAnnotations') === 'true'
    this.errorAnnotations = core.getInput('errorAnnotations') === 'true'
    this.showSDKInfo = core.getInput('showSDKInfo') === 'true'
    this.timingSummary = core.getInput('timingSummary') === 'true'
  }
}

/**
 * Execute modern xcresulttool commands and return structured data
 */
export async function analyzeXcResult(filePath: string): Promise<XcResultData> {
  const [buildResults, testResults, testResultsDetailed] = await Promise.all([
    getBuildResults(filePath),
    getTestResults(filePath),
    getTestResultsDetailed(filePath)
  ])

  return {
    buildResults,
    testResults,
    testResultsDetailed
  }
}

async function getBuildResults(
  filePath: string
): Promise<BuildResults | undefined> {
  try {
    const output = await executeXcResultTool([
      'get',
      'build-results',
      '--path',
      filePath,
      '--compact'
    ])
    return output ? (JSON.parse(output) as BuildResults) : undefined
  } catch (error) {
    core.debug(`Failed to get build results: ${error}`)
    return undefined
  }
}

async function getTestResults(
  filePath: string
): Promise<TestResults | undefined> {
  try {
    const output = await executeXcResultTool([
      'get',
      'test-results',
      'summary',
      '--path',
      filePath,
      '--compact'
    ])
    return output ? (JSON.parse(output) as TestResults) : undefined
  } catch (error) {
    core.debug(`Failed to get test results: ${error}`)
    return undefined
  }
}

async function getTestResultsDetailed(
  filePath: string
): Promise<TestResultsDetailed | undefined> {
  try {
    const output = await executeXcResultTool([
      'get',
      'test-results',
      'tests',
      '--path',
      filePath,
      '--compact'
    ])
    return output ? (JSON.parse(output) as TestResultsDetailed) : undefined
  } catch (error) {
    core.debug(`Failed to get detailed test results: ${error}`)
    return undefined
  }
}

async function executeXcResultTool(args: string[]): Promise<string> {
  let output = ''
  const options: ExecOptions = {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString()
      }
    },
    silent: true
  }

  await exec.exec('xcrun', ['xcresulttool', ...args], options)
  return output.trim()
}

/**
 * Extract simplified metrics from xcresult data
 */
export function extractMetrics(data: XcResultData): Metrics {
  const testResults = data.testResults
  const buildResults = data.buildResults

  return {
    testsTotal: testResults?.totalTestCount || 0,
    testsFailed: testResults?.failedTests || 0,
    testsPassed:
      (testResults?.totalTestCount || 0) - (testResults?.failedTests || 0),
    warnings: buildResults?.warningCount || 0,
    errors: buildResults?.errorCount || 0
  }
}

/**
 * Determine overall conclusion
 */
export function determineConclusion(data: XcResultData): 'success' | 'failure' {
  const metrics = extractMetrics(data)
  const buildFailed = data.buildResults?.status === 'failed'
  const testsFailed = data.testResults?.result === 'Failed'

  return buildFailed || testsFailed || metrics.errors > 0
    ? 'failure'
    : 'success'
}

/**
 * Extract test failures with source location information from detailed test results
 */
function extractTestFailuresWithLocation(
  testResultsDetailed?: TestResultsDetailed
): TestFailureWithLocation[] {
  if (!testResultsDetailed) {
    return []
  }

  const failures: TestFailureWithLocation[] = []

  function traverseTestNodes(nodes: TestNode[], targetName = ''): void {
    for (const node of nodes) {
      // Update target name when we find a test bundle
      let currentTargetName = targetName
      if (
        node.nodeType === 'Unit test bundle' ||
        node.nodeType === 'UI test bundle'
      ) {
        currentTargetName = node.name
      }

      // If this is a failed test case, look for failure messages in children
      if (
        node.nodeType === 'Test Case' &&
        node.result === 'Failed' &&
        node.children
      ) {
        const testName = node.name

        for (const child of node.children) {
          if (child.nodeType === 'Failure Message') {
            const failureInfo = parseFailureMessage(
              child.name,
              testName,
              currentTargetName
            )
            if (failureInfo) {
              failures.push(failureInfo)
            }
          }
        }
      }

      // Recursively process children
      if (node.children) {
        traverseTestNodes(node.children, currentTargetName)
      }
    }
  }

  traverseTestNodes(testResultsDetailed.testNodes)
  return failures
}

/**
 * Parse failure message to extract source location information
 * Format: "MyFrameworkTests.swift:22: XCTAssertTrue failed - Some Failure Text"
 */
function parseFailureMessage(
  failureMessage: string,
  testName: string,
  targetName: string
): TestFailureWithLocation | null {
  // Regex to match: "filename.swift:line: failure message"
  const match = failureMessage.match(/^(.+\.swift):(\d+):\s*(.+)$/)

  if (match) {
    const [, sourceFile, lineNumberStr, failureText] = match
    const lineNumber = parseInt(lineNumberStr, 10)

    return {
      testName,
      targetName,
      failureText,
      sourceFile,
      lineNumber
    }
  }

  // Fallback for non-standard failure message format
  return {
    testName,
    targetName,
    failureText: failureMessage,
    sourceFile: undefined,
    lineNumber: undefined
  }
}

/**
 * Generate GitHub annotations from xcresult data
 */
export function generateAnnotations(
  data: XcResultData,
  settings: GenerationSettings
): GitHubAnnotation[] {
  const annotations: GitHubAnnotation[] = []

  // Test failure annotations - use detailed test results with source locations
  if (settings.testFailureAnnotations) {
    const testFailuresWithLocation = extractTestFailuresWithLocation(
      data.testResultsDetailed
    )

    for (const failure of testFailuresWithLocation) {
      const pathPrefix = core.getInput('pathPrefix')
      let filePath = failure.sourceFile || 'test-file'

      // Remove path prefix if present and source file is available
      if (failure.sourceFile && pathPrefix) {
        filePath = failure.sourceFile // Keep just the filename for test files
      }

      annotations.push({
        path: filePath,
        start_line: failure.lineNumber || 1,
        end_line: failure.lineNumber || 1,
        annotation_level: 'failure',
        title: `${failure.testName} failed`,
        message: failure.failureText
      })
    }
  }

  // Warning annotations
  if (settings.warningAnnotations && data.buildResults?.warnings) {
    for (const warning of data.buildResults.warnings) {
      if (warning.sourceURL) {
        const location = parseSourceURL(warning.sourceURL)
        annotations.push({
          path: location.file,
          start_line: location.startLine || 1,
          end_line: location.endLine || location.startLine || 1,
          annotation_level: 'warning',
          title: warning.issueType || 'Warning',
          message: warning.message || 'Warning occurred'
        })
      }
    }
  }

  // Error annotations
  if (settings.errorAnnotations && data.buildResults?.errors) {
    for (const error of data.buildResults.errors) {
      if (error.sourceURL) {
        const location = parseSourceURL(error.sourceURL)
        annotations.push({
          path: location.file,
          start_line: location.startLine || 1,
          end_line: location.endLine || location.startLine || 1,
          annotation_level: 'failure',
          title: error.issueType || 'Error',
          message: error.message || 'Error occurred'
        })
      }
    }
  }

  // GitHub limits annotations to 50
  return annotations.slice(0, 50)
}

interface SourceLocation {
  file: string
  startLine?: number
  endLine?: number
}

function parseSourceURL(sourceURL: string): SourceLocation {
  try {
    const url = new URL(sourceURL)
    const pathPrefix = core.getInput('pathPrefix')
    const path = url.pathname.replace(`${pathPrefix}/`, '')

    const location: SourceLocation = {file: path}

    // Parse hash parameters for line numbers
    const params = new URLSearchParams(url.hash.substring(1))
    const startLine = params.get('StartingLineNumber')
    const endLine = params.get('EndingLineNumber')

    if (startLine) location.startLine = parseInt(startLine) + 1 // Convert to 1-based
    if (endLine) location.endLine = parseInt(endLine) + 1

    return location
  } catch {
    return {file: 'unknown'}
  }
}

/**
 * Generate markdown summary
 */
export function generateSummary(
  data: XcResultData,
  settings: GenerationSettings
): string {
  const metrics = extractMetrics(data)
  let summaryText = ''

  if (settings.summary) {
    summaryText += `\n## Summary\n`
    summaryText += `🔨 Build finished with **${metrics.errors}** Errors and **${metrics.warnings}** Warnings\n`
    summaryText += `🧪 ${metrics.testsPassed}/${metrics.testsTotal} tests passed\n`
  }

  if (settings.buildSummaryTable) {
    summaryText += `\n\n## Build\n`
    summaryText += `|Errors ⛔️| Warnings ⚠️|\n`
    summaryText += `|:---------------|:----------------|\n`
    summaryText += `| ${metrics.errors} | ${metrics.warnings} |\n`
  }

  if (settings.testSummaryTable) {
    summaryText += `\n\n## Tests\n`
    summaryText += `|Tests Total 🧪|Tests Passed ✅|Tests Failed ⛔️|\n`
    summaryText += `|:---------------|:----------------|:------------|\n`
    summaryText += `| ${metrics.testsTotal} | ${metrics.testsPassed} | ${metrics.testsFailed} |\n`
  }

  return summaryText
}

/**
 * Main function to create GitHub check output
 */
export async function generateGitHubCheckOutput(
  settings: GenerationSettings,
  filePath: string
): Promise<{
  title: string
  summary: string
  annotations: GitHubAnnotation[]
}> {
  const data = await analyzeXcResult(filePath)

  return {
    title: core.getInput('title'),
    summary: generateSummary(data, settings),
    annotations: generateAnnotations(data, settings)
  }
}

/**
 * Main function to determine GitHub check conclusion
 */
export async function generateGitHubCheckConclusion(
  settings: GenerationSettings,
  filePath: string
): Promise<'success' | 'failure'> {
  const data = await analyzeXcResult(filePath)
  return determineConclusion(data)
}

// Backward compatibility functions for tests
export async function convertResultsToJSON(
  filePath: string
): Promise<{metrics: Metrics}> {
  const data = await analyzeXcResult(filePath)
  return {
    metrics: extractMetrics(data)
  }
}

export function testSummaryTable(metrics: Metrics): string {
  return `\n\n## Tests\n|Tests Total 🧪|Tests Passed ✅|Tests Failed ⛔️|\n|:---------------|:----------------|:------------|\n| ${metrics.testsTotal} | ${metrics.testsPassed} | ${metrics.testsFailed} |\n`
}

export function buildSummaryTable(metrics: Metrics): string {
  return `\n\n## Build\n|Errors ⛔️| Warnings ⚠️|\n|:---------------|:----------------|\n| ${metrics.errors} | ${metrics.warnings} |\n`
}

export function summary(metrics: Metrics): string {
  return `\n## Summary\n🔨 Build finished with **${metrics.errors}** Errors and **${metrics.warnings}** Warnings\n🧪 ${metrics.testsPassed}/${metrics.testsTotal} tests passed\n`
}

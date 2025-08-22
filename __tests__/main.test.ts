import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import * as xcresultool from '../src/xcresulttool'
jest.setTimeout(10000)
const FAILED_TEST_FILE = './TestResultsMacFailed.xcresult'
const SUCCEEDED_TEST_FILE = './TestResultsMac.xcresult'
beforeEach(() => {
  process.env['INPUT_PATHPREFIX'] =
    '/Users/thomasbartelmess/Developer/action-test/'
})

test('wait 500 ms', async () => {
  await xcresultool.generateGitHubCheckOutput(
    new xcresultool.GenerationSettings(),
    FAILED_TEST_FILE
  )
})

test('test summary generation', async () => {
  let summary = await xcresultool.convertResultsToJSON(FAILED_TEST_FILE)
  expect(summary).toBeDefined
  expect(summary.metrics).toBeDefined
  let markdown = xcresultool.testSummaryTable(summary.metrics)
  expect(markdown.split('\n').length).toBe(7)
  expect(markdown.split('\n')[5]).toBe('| 2 | 1 | 1 |')
})

test('test check output', async () => {
  let result = await xcresultool.generateGitHubCheckOutput(
    new xcresultool.GenerationSettings(),
    FAILED_TEST_FILE
  )
  expect(result.title).toBeDefined()
  expect(result.summary).toBeDefined()
  expect(result.annotations).toBeDefined()
})

test('check failure outcome', async () => {
  let output = await xcresultool.generateGitHubCheckConclusion(
    new xcresultool.GenerationSettings(),
    FAILED_TEST_FILE
  )
  expect(output).toBe('failure')
})

test('check success outcome', async () => {
  let output = await xcresultool.generateGitHubCheckConclusion(
    new xcresultool.GenerationSettings(),
    SUCCEEDED_TEST_FILE
  )
  expect(output).toBe('success')
})

test('test generate warning annotations', async () => {
  process.env['INPUT_WARNINGANNOTATIONS'] = 'true'
  process.env['INPUT_TESTFAILUREANNOTATIONS'] = 'true'
  let settings = new xcresultool.GenerationSettings()
  settings.readActionSettings()
  let output = await xcresultool.generateGitHubCheckOutput(
    settings,
    FAILED_TEST_FILE
  )
  expect(output.annotations.length).toBe(2)
})

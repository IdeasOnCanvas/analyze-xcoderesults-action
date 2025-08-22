import * as core from '@actions/core'
import * as xcresulttool from './xcresulttool'
import * as github from '@actions/github'
import {RestEndpointMethodTypes} from '@octokit/rest'
import * as ok from '@octokit/action'
type PullRequest = RestEndpointMethodTypes['pulls']['get']['response']['data']
type CheckCreate = RestEndpointMethodTypes['checks']['create']['parameters']
const prEvents = [
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment'
]

function getSHA(): string {
  let sha = github.context.sha
  if (prEvents.includes(github.context.eventName)) {
    const pull = github.context.payload.pull_request as PullRequest
    if (pull?.head.sha) {
      sha = pull?.head.sha
    }
  }
  return sha
}

async function run(): Promise<void> {
  try {
    const ownership = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo
    }
    const sha = getSHA()

    const inputFile: string = core.getInput('results')
    core.info(`Analyzing ${inputFile} ...`)

    const settings = new xcresulttool.GenerationSettings()
    settings.readActionSettings()
    const output = await xcresulttool.generateGitHubCheckOutput(
      settings,
      inputFile
    )
    const conclusion = await xcresulttool.generateGitHubCheckConclusion(
      settings,
      inputFile
    )
    core.debug(
      `Creating a new Run on ${ownership.owner}/${ownership.repo}@${sha}`
    )

    const octokit = new ok.Octokit()

    const checkInfo: CheckCreate = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      name: core.getInput('title'),
      status: 'completed',
      conclusion,
      head_sha: sha,
      output
    }
    await octokit.checks.create(checkInfo)
    core.debug(`Done`)
  } catch (error) {
    let errorMessage = 'Action failed'
    if (error instanceof Error) {
      errorMessage = error.message
    }
    core.setFailed(errorMessage)
  }
}

run()

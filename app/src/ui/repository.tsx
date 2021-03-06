import * as React from 'react'
import { Repository as Repo } from '../models/repository'
import { Commit } from '../models/commit'
import { TipState } from '../models/tip'
import { UiView } from './ui-view'
import { Changes, ChangesSidebar } from './changes'
import { NoChanges } from './changes/no-changes'
import { History, HistorySidebar } from './history'
// import { Resizable } from './resizable'
import { TabBar } from './tab-bar'
import {
  IRepositoryState as IRepositoryModelState,
  RepositorySection,
  ImageDiffType,
} from '../lib/app-state'
import { Dispatcher } from '../lib/dispatcher'
import { IssuesStore, GitHubUserStore, AppStore } from '../lib/stores'
import { assertNever } from '../lib/fatal-error'
import { Octicon, OcticonSymbol } from './octicons'
import { Account } from '../models/account'


/** The widest the sidebar can be with the minimum window size. */
// const MaxSidebarWidth = 495

interface IRepositoryProps {
  readonly repository: Repo
  readonly state: IRepositoryModelState
  readonly dispatcher: Dispatcher
  readonly emoji: Map<string, string>
  readonly sidebarWidth: number
  readonly commitSummaryWidth: number
  readonly issuesStore: IssuesStore
  readonly appStore: AppStore
  readonly gitHubUserStore: GitHubUserStore
  readonly onViewCommitOnGitHub: (SHA: string) => void
  readonly imageDiffType: ImageDiffType
  readonly askForConfirmationOnDiscardChanges: boolean
  readonly accounts: ReadonlyArray<Account>
}

const enum Tab {
  Changes = 0,
  History = 1,
}

export class RepositoryView extends React.Component<IRepositoryProps, {}> {
  private renderTabs(): JSX.Element {
    const hasChanges =
      this.props.state.changesState.workingDirectory.files.length > 0
    const selectedTab =
      this.props.state.selectedSection === RepositorySection.Changes
        ? Tab.Changes
        : Tab.History

    // this.onTabClicked(Tab.Changes)
    // this.onTabClicked(Tab.History)
    return (
      <TabBar selectedIndex={selectedTab} onTabClicked={() => {}}>
        <span className="with-indicator">
          <span>Changes</span>
          {hasChanges ? (
            <Octicon
              className="indicator"
              symbol={OcticonSymbol.primitiveDot}
            />
          ) : null}
        </span>
        <span>History</span>
      </TabBar>
    )
  }

  public componentWillMount() {
    console.log('WTF')
     this.onTabClicked(Tab.Changes, this.props)
     this.onTabClicked(Tab.History, this.props)
  }

  public componentWillReceiveProps(nextProps: IRepositoryProps) {
    if(this.props.repository.name !== nextProps.repository.name) {
      this.onTabClicked(Tab.Changes, nextProps)
      this.onTabClicked(Tab.History, nextProps)
    }
  }
  private renderChangesSidebar(): JSX.Element {
    const tip = this.props.state.branchesState.tip
    const branch = tip.kind === TipState.Valid ? tip.branch : null

    const localCommitSHAs = this.props.state.localCommitSHAs
    const mostRecentLocalCommitSHA =
      localCommitSHAs.length > 0 ? localCommitSHAs[0] : null
    const mostRecentLocalCommit =
      (mostRecentLocalCommitSHA
        ? this.props.state.commits.get(mostRecentLocalCommitSHA)
        : null) || null

    // -1 Because of right hand side border
    const availableWidth = this.props.sidebarWidth - 1

    return (
      <ChangesSidebar
        repository={this.props.repository}
        dispatcher={this.props.dispatcher}
        changes={this.props.state.changesState}
        appStore={this.props.appStore}
        branch={branch ? branch.name : null}
        commitAuthor={this.props.state.commitAuthor}
        gitHubUsers={this.props.state.gitHubUsers}
        emoji={this.props.emoji}
        mostRecentLocalCommit={mostRecentLocalCommit}
        issuesStore={this.props.issuesStore}
        availableWidth={availableWidth}
        gitHubUserStore={this.props.gitHubUserStore}
        isCommitting={this.props.state.isCommitting}
        isPushPullFetchInProgress={this.props.state.isPushPullFetchInProgress}
        askForConfirmationOnDiscardChanges={
          this.props.askForConfirmationOnDiscardChanges
        }
        accounts={this.props.accounts}
      />
    )
  }

  private renderHistorySidebar(): JSX.Element {
    return (
      <HistorySidebar
        repository={this.props.repository}
        dispatcher={this.props.dispatcher}
        history={this.props.state.historyState}
        gitHubUsers={this.props.state.gitHubUsers}
        emoji={this.props.emoji}
        commits={this.props.state.commits}
        localCommitSHAs={this.props.state.localCommitSHAs}
        onRevertCommit={this.onRevertCommit}
        onViewCommitOnGitHub={this.props.onViewCommitOnGitHub}
      />
    )
  }

  // private renderSidebarContents(): JSX.Element {
  //   const selectedSection = this.props.state.selectedSection

  //   if (selectedSection === RepositorySection.Changes) {
  //     return this.renderChangesSidebar()
  //   } else if (selectedSection === RepositorySection.History) {
  //     return this.renderHistorySidebar()
  //   } else {
  //     return assertNever(selectedSection, 'Unknown repository section')
  //   }
  // }

  // private handleSidebarWidthReset = () => {
  //   this.props.dispatcher.resetSidebarWidth()
  // }

  // private handleSidebarResize = (width: number) => {
  //   // this.props.dispatcher.setSidebarWidth(width)
  // }

  private renderSidebar(): JSX.Element {
    return (
      // <Resizable
      //   id="repository-sidebar"
      //   width={this.props.sidebarWidth}
      //   onReset={this.handleSidebarWidthReset}
      //   onResize={this.handleSidebarResize}
      //   maximumWidth={MaxSidebarWidth}
      // >
      <UiView id="sidebar">
        {this.renderTabs()}
        <UiView style={{position: 'relative', display: 'flex', flexDirection: 'row'}}>
        <UiView style={{left: 0,  bottom: 0, top: 0, borderRight: '1px solid #24292e', zIndex: 2, flex: 1}}>
          {this.renderChangesSidebar()}
        </UiView>
        <UiView style={{ right: 0,  bottom: 0, marginTop:70, zIndex: 1, borderTop: '1px solid #e1e4e8', flex: 1}}>
          {this.renderHistorySidebar()}
        </UiView>
        </UiView>
      </UiView>
    )
  }

  private renderContent(): JSX.Element {
    const selectedSection = this.props.state.selectedSection

    if (selectedSection === RepositorySection.Changes) {
      const changesState = this.props.state.changesState
      const selectedFileID = changesState.selectedFileID
      const selectedFile = selectedFileID
        ? changesState.workingDirectory.findFileWithID(selectedFileID)
        : null
      const diff = changesState.diff
      if (
        !changesState.workingDirectory.files.length ||
        !selectedFile ||
        !diff
      ) {
        return <NoChanges onOpenRepository={this.openRepository} />
      } else {
        return (
          <Changes
            repository={this.props.repository}
            dispatcher={this.props.dispatcher}
            file={selectedFile}
            diff={diff}
            imageDiffType={this.props.imageDiffType}
          />
        )
      }
    } else if (selectedSection === RepositorySection.History) {
      return (
        <History
          repository={this.props.repository}
          dispatcher={this.props.dispatcher}
          history={this.props.state.historyState}
          emoji={this.props.emoji}
          commits={this.props.state.commits}
          commitSummaryWidth={this.props.commitSummaryWidth}
          gitHubUsers={this.props.state.gitHubUsers}
          imageDiffType={this.props.imageDiffType}
        />
      )
    } else {
      return assertNever(selectedSection, 'Unknown repository section')
    }
  }

  public render() {
    return (
      <UiView id="repository" onKeyDown={this.onKeyDown}>
        {this.renderSidebar()}
        {false && this.renderContent()}
      </UiView>
    )
  }

  private openRepository = () => {
    this.props.dispatcher.revealInFileManager(this.props.repository, '')
  }

  private onRevertCommit = (commit: Commit) => {
    this.props.dispatcher.revertCommit(this.props.repository, commit)
  }

  private onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Toggle tab selection on Ctrl+Tab. Note that we don't care
    // about the shift key here, we can get away with that as long
    // as there's only two tabs.
    if (e.ctrlKey && e.key === 'Tab') {
      const section =
        this.props.state.selectedSection === RepositorySection.History
          ? RepositorySection.Changes
          : RepositorySection.History

      this.props.dispatcher.changeRepositorySection(
        this.props.repository,
        section
      )
      e.preventDefault()
    }
  }

  private onTabClicked = (tab: Tab, props: IRepositoryProps) => {
    const section =
      tab === Tab.History
        ? RepositorySection.History
        : RepositorySection.Changes
    this.props.dispatcher.changeRepositorySection(
      props.repository,
      section
    )
  }
}

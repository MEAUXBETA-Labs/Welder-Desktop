import * as Path from 'path'
import * as React from 'react'

import { ChangesList } from './changes-list'
import { DiffSelectionType } from '../../models/diff'
import { IChangesState, PopupType } from '../../lib/app-state'
import { Repository } from '../../models/repository'
import { Dispatcher } from '../../lib/dispatcher'
import { IGitHubUser } from '../../lib/databases'
import { IssuesStore, GitHubUserStore } from '../../lib/stores'
import { CommitIdentity } from '../../models/commit-identity'
import { Commit } from '../../models/commit'
import {
  IAutocompletionProvider,
  EmojiAutocompletionProvider,
  IssuesAutocompletionProvider,
  UserAutocompletionProvider,
} from '../autocompletion'
import { ClickSource } from '../lib/list'
import { WorkingDirectoryFileChange } from '../../models/status'
import { openFile } from '../../lib/open-file'
import { ITrailer } from '../../lib/git/interpret-trailers'
import { Account } from '../../models/account'
import { AppStore } from '../../lib/stores'

interface IChangesSidebarProps {
  readonly repository: Repository
  readonly changes: IChangesState
  readonly dispatcher: Dispatcher
  readonly commitAuthor: CommitIdentity | null
  readonly branch: string | null
  readonly gitHubUsers: Map<string, IGitHubUser>
  readonly emoji: Map<string, string>
  readonly mostRecentLocalCommit: Commit | null
  readonly issuesStore: IssuesStore
  readonly availableWidth: number
  readonly appStore: AppStore
  readonly isCommitting: boolean
  readonly isPushPullFetchInProgress: boolean
  readonly gitHubUserStore: GitHubUserStore
  readonly askForConfirmationOnDiscardChanges: boolean
  readonly accounts: ReadonlyArray<Account>
}

export class ChangesSidebar extends React.Component<IChangesSidebarProps, {}> {
  private autocompletionProviders: ReadonlyArray<
    IAutocompletionProvider<any>
  > | null

  public constructor(props: IChangesSidebarProps) {
    super(props)

    this.receiveProps(props)
  }

  public componentWillReceiveProps(nextProps: IChangesSidebarProps) {
    this.receiveProps(nextProps)
  }

  private receiveProps(props: IChangesSidebarProps) {
    if (
      props.repository.id !== this.props.repository.id ||
      !this.autocompletionProviders ||
      props.accounts !== this.props.accounts
    ) {
      const autocompletionProviders: IAutocompletionProvider<any>[] = [
        new EmojiAutocompletionProvider(this.props.emoji),
      ]

      // Issues autocompletion is only available for GitHub repositories.
      const gitHubRepository = props.repository.gitHubRepository
      if (gitHubRepository) {
        autocompletionProviders.push(
          new IssuesAutocompletionProvider(
            props.issuesStore,
            gitHubRepository,
            props.dispatcher
          )
        )

        const account = this.props.accounts.find(
          a => a.endpoint === gitHubRepository.endpoint
        )

        autocompletionProviders.push(
          new UserAutocompletionProvider(
            props.gitHubUserStore,
            gitHubRepository,
            account
          )
        )
      }

      this.autocompletionProviders = autocompletionProviders
    }
  }

  private onCreateCommit = (
    summary: string,
    description: string | null,
    trailers?: ReadonlyArray<ITrailer>
  ): Promise<boolean> => {
    return this.props.dispatcher.commitIncludedChanges(
      this.props.repository,
      summary,
      description,
      trailers
    )
  }

  private onFileSelectionChanged = (row: number) => {
    const file = this.props.changes.workingDirectory.files[row]
    this.props.dispatcher.changeChangesSelection(this.props.repository, file)
  }

  private onIncludeChanged = (path: string, include: boolean) => {
    const workingDirectory = this.props.changes.workingDirectory
    const file = workingDirectory.files.find(f => f.path === path)
    if (!file) {
      console.error(
        'unable to find working directory file to apply included change: ' +
          path
      )
      return
    }

    this.props.dispatcher.changeFileIncluded(
      this.props.repository,
      file,
      include
    )
  }

  private onSelectAll = (selectAll: boolean) => {
    this.props.dispatcher.changeIncludeAllFiles(
      this.props.repository,
      selectAll
    )
  }

  private onDiscardChanges = (file: WorkingDirectoryFileChange) => {
    if (!this.props.askForConfirmationOnDiscardChanges) {
      this.props.dispatcher.discardChanges(this.props.repository, [file])
    } else {
      this.props.dispatcher.showPopup({
        type: PopupType.ConfirmDiscardChanges,
        repository: this.props.repository,
        files: [file],
      })
    }
  }

  private onDiscardAllChanges = (
    files: ReadonlyArray<WorkingDirectoryFileChange>
  ) => {
    if (!this.props.askForConfirmationOnDiscardChanges) {
      this.props.dispatcher.discardChanges(this.props.repository, files)
    } else {
      this.props.dispatcher.showPopup({
        type: PopupType.ConfirmDiscardChanges,
        repository: this.props.repository,
        files,
      })
    }
  }

  private onIgnore = (pattern: string) => {
    this.props.dispatcher.ignore(this.props.repository, pattern)
  }

  /**
   * Reveals a file from a repository in the native file manager.
   * @param path The path of the file relative to the root of the repository
   */
  private onRevealInFileManager = (path: string) => {
    this.props.dispatcher.revealInFileManager(this.props.repository, path)
  }

  /**
   * Open file with default application.
   * @param path The path of the file relative to the root of the repository
   */
  private onOpenItem = (path: string) => {
    const fullPath = Path.join(this.props.repository.path, path)
    openFile(fullPath, this.props.dispatcher)
  }

  /**
   * Toggles the selection of a given working directory file.
   * If the file is partially selected it the selection is cleared
   * in order to match the behavior of clicking on an indeterminate
   * checkbox.
   */
  private onToggleInclude(row: number) {
    const workingDirectory = this.props.changes.workingDirectory
    const file = workingDirectory.files[row]

    if (!file) {
      console.error('keyboard selection toggle despite no file - what?')
      return
    }

    const currentSelection = file.selection.getSelectionType()

    this.props.dispatcher.changeFileIncluded(
      this.props.repository,
      file,
      currentSelection === DiffSelectionType.None
    )
  }

  /**
   * Handles click events from the List item container, note that this is
   * Not the same thing as the element returned by the row renderer in ChangesList
   */
  private onChangedItemClick = (row: number, source: ClickSource) => {
    // Toggle selection when user presses the spacebar or enter while focused
    // on a list item
    if (source.kind === 'keyboard') {
      this.onToggleInclude(row)
    }
  }

  public render() {
    const changesState = this.props.changes
    const selectedFileID = changesState.selectedFileID

    const email = this.props.commitAuthor ? this.props.commitAuthor.email : null
    let user: IGitHubUser | null = null
    if (email) {
      user = this.props.gitHubUsers.get(email.toLowerCase()) || null
    }

    return (
      <div id="changes-sidebar-contents">
        <ChangesList
          dispatcher={this.props.dispatcher}
          appStore={this.props.appStore}
          repository={this.props.repository}
          workingDirectory={changesState.workingDirectory}
          selectedFileID={selectedFileID}
          onFileSelectionChanged={this.onFileSelectionChanged}
          onCreateCommit={this.onCreateCommit}
          onIncludeChanged={this.onIncludeChanged}
          onSelectAll={this.onSelectAll}
          onDiscardChanges={this.onDiscardChanges}
          onDiscardAllChanges={this.onDiscardAllChanges}
          onRevealInFileManager={this.onRevealInFileManager}
          onOpenItem={this.onOpenItem}
          onRowClick={this.onChangedItemClick}
          commitAuthor={this.props.commitAuthor}
          branch={this.props.branch}
          gitHubUser={user}
          commitMessage={this.props.changes.commitMessage}
          contextualCommitMessage={this.props.changes.contextualCommitMessage}
          autocompletionProviders={this.autocompletionProviders!}
          availableWidth={this.props.availableWidth}
          onIgnore={this.onIgnore}
          isCommitting={this.props.isCommitting}
          showCoAuthoredBy={this.props.changes.showCoAuthoredBy}
        />
      </div>
    )
  }
}

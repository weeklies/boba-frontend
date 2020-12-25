import React from "react";
import {
  FeedWithMenu,
  CycleNewButton,
  toast,
  PostingActionButton,
  // @ts-ignore
} from "@bobaboard/ui-components";
import Layout from "components/Layout";
import PostEditorModal from "components/editors/PostEditorModal";
import CommentEditorModal from "components/editors/CommentEditorModal";
import { useAuth } from "components/Auth";
import {
  PostType,
  CommentType,
  THREAD_VIEW_MODES,
  ThreadType,
} from "types/Types";
import {
  updateCommentCache,
  updatePostCache,
  updatePostTagsInCache,
} from "utils/queries/cache";
import classnames from "classnames";
import { useBoardContext } from "components/BoardContext";
//import { useHotkeys } from "react-hotkeys-hook";
import ThreadView, {
  scrollToComment,
  scrollToPost,
} from "components/thread/ThreadView";
import ThreadSidebar from "components/thread/ThreadSidebar";
import GalleryThreadView from "components/thread/GalleryThreadView";
import TimelineThreadView from "components/thread/TimelineThreadView";
import { useThread } from "components/thread/ThreadQueryHook";
import { useRouter } from "next/router";
import { ThreadPageDetails, usePageDetails } from "../../../utils/router-utils";

import debug from "debug";
import { useCachedLinks } from "components/hooks/useCachedLinks";
import { useQueryParam } from "use-query-params";
import { ExistanceParam } from "components/QueryParamNextProvider";
const log = debug("bobafrontend:threadPage-log");

const getViewTypeFromString = (
  viewString: ThreadType["defaultView"] | null
) => {
  if (!viewString) {
    return null;
  }
  switch (viewString) {
    case "gallery":
      return THREAD_VIEW_MODES.MASONRY;
    case "timeline":
      return THREAD_VIEW_MODES.TIMELINE;
    case "thread":
      return THREAD_VIEW_MODES.THREAD;
  }
};

const MemoizedThreadSidebar = React.memo(ThreadSidebar);
const MemoizedThreadView = React.memo(ThreadView);
const MemoizedGalleryThreadView = React.memo(GalleryThreadView);
const MemoizedTimelineThreadView = React.memo(TimelineThreadView);
function ThreadPage() {
  const [postReplyId, setPostReplyId] = React.useState<string | null>(null);
  const [postEdit, setPostEdit] = React.useState<PostType | null>(null);
  const [commentReplyId, setCommentReplyId] = React.useState<{
    postId: string | null;
    commentId: string | null;
  } | null>(null);
  const {
    postId,
    threadBaseUrl,
    slug,
    threadId,
  } = usePageDetails<ThreadPageDetails>();
  const { user, isLoggedIn, isPending: isAuthPending } = useAuth();
  const { getLinkToBoard } = useCachedLinks();
  const router = useRouter();
  const {
    threadRoot,
    newAnswersSequence,
    isLoading: isFetchingThread,
    personalIdentity,
    defaultView,
    categories,
  } = useThread({ threadId, postId, slug });
  const { boardsData } = useBoardContext();
  const currentBoardData = boardsData?.[slug];
  const [viewMode, setViewMode] = React.useState(
    getViewTypeFromString(defaultView) || THREAD_VIEW_MODES.THREAD
  );
  const [maxDisplay, setMaxDisplay] = React.useState(2);

  const [showSidebar, setShowSidebar] = React.useState(false);
  const closeSidebar = React.useCallback(() => setShowSidebar(false), []);
  const onCompassClick = React.useCallback(() => setShowSidebar(!showSidebar), [
    showSidebar,
  ]);

  const [gallery, setGallery] = useQueryParam("gallery", ExistanceParam);
  const [timeline, setTimeline] = useQueryParam("timeline", ExistanceParam);
  const [thread, setThread] = useQueryParam("thread", ExistanceParam);

  React.useEffect(() => {
    setGallery(viewMode == THREAD_VIEW_MODES.MASONRY);
    setTimeline(viewMode == THREAD_VIEW_MODES.TIMELINE);
    setThread(viewMode == THREAD_VIEW_MODES.THREAD);
  }, [viewMode]);

  React.useEffect(() => {
    if (!isFetchingThread) {
      setViewMode(
        getViewTypeFromString(defaultView) || THREAD_VIEW_MODES.THREAD
      );
    }
  }, [isFetchingThread]);
  const newAnswersIndex = React.useRef<number>(-1);

  // TODO: disable this while post editing and readd
  // const currentPostIndex = React.useRef<number>(-1);
  // useHotkeys(
  //   "n",
  //   () => {
  //     if (!postsDisplaySequence) {
  //       return;
  //     }
  //     currentPostIndex.current =
  //       (currentPostIndex.current + 1) % postsDisplaySequence.length;
  //     scrollToPost(
  //       postsDisplaySequence[currentPostIndex.current].postId,
  //       boardData.accentColor
  //     );
  //   },
  //   [postsDisplaySequence]
  // );

  React.useEffect(() => {
    if (currentBoardData?.loggedInOnly && !isAuthPending && !isLoggedIn) {
      // TODO: this happens after the thread has already 403'd
      getLinkToBoard(slug).onClick?.();
    }
  }, [currentBoardData, isAuthPending, isLoggedIn]);

  const onNewAnswersButtonClick = () => {
    if (!newAnswersSequence) {
      return;
    }
    log(newAnswersSequence);
    log(newAnswersIndex);
    // @ts-ignore
    newAnswersIndex.current =
      (newAnswersIndex.current + 1) % newAnswersSequence.length;
    const nextPost = newAnswersSequence[newAnswersIndex.current].postId;
    const nextComment = newAnswersSequence[newAnswersIndex.current].commentId;
    if (nextPost) {
      scrollToPost(nextPost, currentBoardData?.accentColor || "#f96680");
    }
    if (nextComment) {
      scrollToComment(nextComment, currentBoardData?.accentColor || "#f96680");
    }
  };

  const replyToComment = React.useCallback(
    (replyToPostId, replyToCommentId) =>
      setCommentReplyId({
        postId: replyToPostId,
        commentId: replyToCommentId,
      }),
    []
  );

  const canTopLevelPost =
    isLoggedIn &&
    (viewMode == THREAD_VIEW_MODES.MASONRY ||
      viewMode == THREAD_VIEW_MODES.TIMELINE);

  return (
    <div className="main">
      {isLoggedIn && (
        <>
          <PostEditorModal
            isOpen={!!postReplyId || !!postEdit}
            secretIdentity={personalIdentity}
            userIdentity={{
              name: user?.username,
              avatar: user?.avatarUrl,
            }}
            // TODO: this transformation shouldn't be done here.
            additionalIdentities={
              !personalIdentity && currentBoardData?.postingIdentities
                ? currentBoardData.postingIdentities.map((identity) => ({
                    ...identity,
                    avatar: identity.avatarUrl,
                  }))
                : undefined
            }
            onPostSaved={(post: PostType) => {
              log(
                `Saved new prompt to thread ${threadId}, replying to post ${postReplyId}.`
              );
              log(post);
              if (
                postEdit &&
                !updatePostTagsInCache({
                  threadId,
                  postId: post.postId,
                  tags: post.tags,
                })
              ) {
                toast.error(`Error updating post cache after editing tags.`);
              } else if (postReplyId && !updatePostCache({ threadId, post })) {
                toast.error(
                  `Error updating post cache after posting new post.`
                );
              }
              setPostReplyId(null);
              setPostEdit(null);
            }}
            onCloseModal={() => {
              setPostReplyId(null);
              setPostEdit(null);
            }}
            slug={slug}
            editPost={postEdit}
            replyToPostId={postReplyId}
            uploadBaseUrl={`images/${slug}/${router.query.id}/`}
            suggestedCategories={categories}
          />
          <CommentEditorModal
            isOpen={!!commentReplyId}
            userIdentity={{
              name: user?.username,
              avatar: user?.avatarUrl,
            }}
            secretIdentity={personalIdentity}
            additionalIdentities={
              !personalIdentity && currentBoardData?.postingIdentities
                ? currentBoardData.postingIdentities.map((identity) => ({
                    ...identity,
                    avatar: identity.avatarUrl,
                  }))
                : undefined
            }
            onCommentsSaved={(comments: CommentType[]) => {
              log(
                `Saved new comment(s) to thread ${threadId}, replying to post ${commentReplyId}.`
              );
              log(comments);
              if (
                !commentReplyId ||
                !updateCommentCache({
                  threadId,
                  newComments: comments,
                  replyTo: commentReplyId,
                })
              ) {
                toast.error(
                  `Error updating comment cache after posting new comment.`
                );
              }
              setCommentReplyId(null);
            }}
            onCloseModal={() => setCommentReplyId(null)}
            replyTo={commentReplyId}
          />
        </>
      )}
      <Layout
        mainContent={
          <FeedWithMenu
            forceHideSidebar={router.query.hideSidebar !== undefined}
            showSidebar={showSidebar}
            onCloseSidebar={closeSidebar}
            sidebarContent={
              <MemoizedThreadSidebar
                viewMode={viewMode}
                open={showSidebar}
                onViewChange={React.useCallback(
                  (viewMode) => {
                    setViewMode(viewMode);
                  },
                  [threadBaseUrl]
                )}
              />
            }
            feedContent={
              <div
                className={classnames("feed", {
                  thread: viewMode == THREAD_VIEW_MODES.THREAD || postId,
                  masonry: viewMode == THREAD_VIEW_MODES.MASONRY && !postId,
                  timeline: viewMode == THREAD_VIEW_MODES.TIMELINE && !postId,
                  loading: isFetchingThread,
                })}
              >
                <div className="view-modes">
                  {viewMode == THREAD_VIEW_MODES.THREAD || postId ? (
                    <MemoizedThreadView
                      onNewComment={replyToComment}
                      onNewContribution={setPostReplyId}
                      onEditPost={setPostEdit}
                      isLoggedIn={isLoggedIn}
                    />
                  ) : viewMode == THREAD_VIEW_MODES.MASONRY ? (
                    <MemoizedGalleryThreadView
                      onNewComment={replyToComment}
                      onNewContribution={setPostReplyId}
                      isLoggedIn={isLoggedIn}
                      onEditPost={setPostEdit}
                      displayAtMost={maxDisplay}
                    />
                  ) : (
                    <MemoizedTimelineThreadView
                      onNewComment={replyToComment}
                      onNewContribution={setPostReplyId}
                      isLoggedIn={isLoggedIn}
                      onEditPost={setPostEdit}
                      displayAtMost={maxDisplay}
                    />
                  )}
                </div>
                <div
                  className={classnames("loading-indicator", {
                    loading: isFetchingThread,
                  })}
                >
                  Loading...
                </div>
                <div
                  className="bobadab"
                  onClick={() => {
                    window.scroll({
                      top: 0,
                      behavior: "smooth",
                    });
                  }}
                />
              </div>
            }
            onReachEnd={React.useCallback(() => {
              setMaxDisplay((maxDisplay) => maxDisplay + 2);
            }, [])}
          />
        }
        title={`!${slug}`}
        loading={isFetchingThread}
        onCompassClick={onCompassClick}
        actionButton={
          viewMode == THREAD_VIEW_MODES.THREAD &&
          !!newAnswersSequence.length ? (
            <CycleNewButton text="Next New" onNext={onNewAnswersButtonClick} />
          ) : canTopLevelPost ? (
            <PostingActionButton
              accentColor={currentBoardData?.accentColor || "#f96680"}
              onNewPost={() => threadRoot && setPostReplyId(threadRoot.postId)}
            />
          ) : undefined
        }
      />
      <style jsx>
        {`
          .feed {
            max-width: 100%;
            padding-bottom: 70px;
            position: relative;
          }
          .feed.loading .view-modes {
            display: none;
          }
          .feed.timeline {
            width: 100%;
          }
          .feed.masonry {
            width: 100%;
            position: relative;
            margin-top: 20px;
          }
          .loading-indicator {
            color: white;
            width: 100%;
            text-align: center;
            padding: 20px;
            display: none;
          }
          .loading-indicator.loading {
            display: block;
          }
          .bobadab {
            display: none;
            position: absolute;
            width: 50px;
            height: 50px;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            background-image: url("/bobadab.png");
            background-size: contain;
          }
          .bobadab:hover {
            cursor: pointer;
          }
          .feed:not(.loading) .bobadab {
            display: block;
          }
        `}
      </style>
    </div>
  );
}

export default ThreadPage;

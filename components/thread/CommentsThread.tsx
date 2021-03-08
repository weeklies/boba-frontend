import React from "react";
import {
  CommentChain,
  CommentHandler,
  NewCommentsThread,
} from "@bobaboard/ui-components";
import { CommentType, ThreadCommentInfoType } from "../../types/Types";
import { useThreadContext } from "./ThreadContext";
import { faComment } from "@fortawesome/free-regular-svg-icons";

import moment from "moment";
import { useAuth } from "components/Auth";
import { useThreadEditors } from "components/editors/withEditors";
import { useForceHideIdentity } from "components/hooks/useForceHideIdentity";

// import debug from "debug";
// const log = debug("bobafrontend:CommentsThread-log");
// const info = debug("bobafrontend:CommentsThread-info");

const getCommentsChain = (
  rootComment: CommentType,
  parentChainMap: ThreadCommentInfoType["parentChainMap"]
) => {
  const chain = [rootComment];
  while (parentChainMap.has(chain[chain.length - 1].commentId)) {
    const next = parentChainMap.get(chain[chain.length - 1].commentId)!;
    chain.push(next);
  }
  return chain;
};

// TODO: clear commentHandlers when changing thread
export const commentHandlers = new Map<string, CommentHandler>();
const ThreadComment: React.FC<{
  rootComment: CommentType;
  parentPostId: string;
  onAvatarRef: (element: HTMLElement | null) => void;
}> = ({ rootComment, parentPostId, onAvatarRef }) => {
  const { isLoggedIn } = useAuth();
  const { forceHideIdentity } = useForceHideIdentity();
  const { onNewComment } = useThreadEditors();
  const { postCommentsMap } = useThreadContext();
  const { parentChainMap } = postCommentsMap.get(parentPostId)!;
  const chainInfo = React.useMemo(
    () =>
      getCommentsChain(rootComment, parentChainMap).map((comment) => ({
        id: comment.commentId,
        text: comment.content,
      })),
    [rootComment, parentChainMap]
  );
  const replyToLast = React.useCallback(
    () => onNewComment(parentPostId, chainInfo[chainInfo.length - 1].id),
    [parentPostId, chainInfo, onNewComment]
  );
  const onSetRef = React.useCallback(
    (handler: CommentHandler | null) => {
      if (handler == null) {
        return;
      }
      chainInfo.forEach((el) => commentHandlers.set(el.id, handler));
      onAvatarRef(handler.avatarRef?.current || null);
    },
    [chainInfo, onAvatarRef]
  );
  const options = React.useMemo(
    () =>
      isLoggedIn
        ? [
            {
              name: "Reply",
              icon: faComment,
              link: {
                onClick: replyToLast,
              },
            },
          ]
        : undefined,
    [replyToLast, isLoggedIn]
  );

  return (
    <CommentChain
      ref={onSetRef}
      key={rootComment.commentId}
      secretIdentity={rootComment.secretIdentity}
      userIdentity={rootComment.userIdentity}
      createdTime={moment.utc(rootComment.created).fromNow()}
      accessory={rootComment.accessory}
      comments={chainInfo}
      muted={isLoggedIn && !rootComment.isNew}
      onExtraAction={isLoggedIn ? replyToLast : undefined}
      options={options}
      forceHideIdentity={forceHideIdentity}
    />
  );
};

const CommentsThreadLevel: React.FC<{
  comment: CommentType;
  parentPostId: string;
  parentCommentId?: string | null;
  level?: number;
}> = ({ parentPostId, comment }) => {
  const { postCommentsMap } = useThreadContext();
  const { parentChainMap, parentChildrenMap } = postCommentsMap.get(
    parentPostId
  )!;

  const chain = React.useMemo(() => getCommentsChain(comment, parentChainMap), [
    comment,
    parentChainMap,
  ]);

  const children = parentChildrenMap.get(chain[chain.length - 1].commentId);
  return (
    <NewCommentsThread.Item>
      {(setBoundaryElement) => (
        <>
          <ThreadComment
            rootComment={comment}
            parentPostId={parentPostId}
            onAvatarRef={setBoundaryElement}
          />
          <div className="comment" data-comment-id={comment.commentId}></div>
          {children && (
            <NewCommentsThread.Indent id={comment.commentId}>
              {children.map((comment: CommentType) => {
                return (
                  <MemoizedThreadLevel
                    key={comment.commentId}
                    comment={comment}
                    parentPostId={parentPostId}
                  />
                );
              })}
            </NewCommentsThread.Indent>
          )}
        </>
      )}
    </NewCommentsThread.Item>
  );
};
const MemoizedThreadLevel = React.memo(CommentsThreadLevel);

interface CommentsThreadProps {
  parentPostId: string;
  parentCommentId?: string | null;
  level?: number;
}

const CommentsThread: React.FC<CommentsThreadProps> = (props) => {
  const { postCommentsMap } = useThreadContext();

  if (!postCommentsMap.has(props.parentPostId)) {
    return null;
  }

  const { roots, parentChildrenMap } = postCommentsMap.get(props.parentPostId)!;
  const actualRoots = props.parentCommentId
    ? parentChildrenMap.get(props.parentCommentId) || []
    : roots;

  return (
    <div className="comments-thread-container">
      {actualRoots.map((comment) => {
        return (
          <div className="comments-thread" key={comment.commentId}>
            <NewCommentsThread>
              <MemoizedThreadLevel
                key={comment.commentId}
                comment={comment}
                parentPostId={props.parentPostId}
              />
            </NewCommentsThread>
          </div>
        );
      })}
      <style jsx>{`
        .comments-thread-container {
          pointer-events: all;
          margin-left: 15px;
        }
        .comments-thread {
          margin-top: 20px;
        }
      `}</style>
    </div>
  );
};

export default React.memo(CommentsThread);

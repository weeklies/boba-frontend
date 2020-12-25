import React from "react";
import {
  CommentChain,
  CommentHandler,
  CompactThreadIndent,
  useIndent,
} from "@bobaboard/ui-components";
import { CommentType, ThreadCommentInfoType } from "../../types/Types";
import { useThread } from "./ThreadQueryHook";

import debug from "debug";
import { usePageDetails, ThreadPageDetails } from "utils/router-utils";
// @ts-expect-error
const log = debug("bobafrontend:threadLevel-log");
// @ts-expect-error
const info = debug("bobafrontend:threadLevel-info");

const CommentsThreadLevel: React.FC<{
  comment: CommentType;
  parentChainMap: Map<string, CommentType>;
  parentChildrenMap: Map<string, CommentType[]>;
  parentPostId: string;
  parentCommentId: string | null;
  isLoggedIn: boolean;
  level: number;
  onReplyTo: (replyTo: string) => void;
}> = (props) => {
  const indent = useIndent();
  const chain = [props.comment];
  let currentChainId = props.comment.commentId;
  while (props.parentChainMap.has(currentChainId)) {
    const next = props.parentChainMap.get(currentChainId) as CommentType;
    chain.push(next);
    currentChainId = next.commentId;
  }
  const lastCommentId = chain[chain.length - 1].commentId;
  const children = props.parentChildrenMap.get(lastCommentId);
  const replyToLast = React.useCallback(() => props.onReplyTo(lastCommentId), [
    lastCommentId,
  ]);
  return (
    <CompactThreadIndent
      level={props.level}
      startsFromViewport={indent.bounds}
      hideLine={!children}
    >
      <div className="comment" data-comment-id={props.comment.commentId}>
        <CommentChain
          ref={(handler: CommentHandler | null) => {
            if (handler == null) {
              return;
            }
            chain.forEach((el) => commentHandlers.set(el.commentId, handler));
            indent.setHandler(handler);
          }}
          key={props.comment.commentId}
          secretIdentity={props.comment.secretIdentity}
          userIdentity={props.comment.userIdentity}
          accessory={props.comment.accessory}
          comments={chain.map((el) => ({
            id: el.commentId,
            text: el.content,
          }))}
          muted={props.isLoggedIn && !props.comment.isNew}
          onExtraAction={props.isLoggedIn ? replyToLast : undefined}
        />
      </div>
      {children ? (
        <CommentsThread
          level={props.level + 1}
          parentCommentId={lastCommentId}
          parentPostId={props.parentPostId}
          isLoggedIn={props.isLoggedIn}
          onReplyTo={props.onReplyTo}
        />
      ) : (
        <></>
      )}
    </CompactThreadIndent>
  );
};

// TODO: clear commentHandlers when changing thread
export const commentHandlers = new Map<string, CommentHandler>();
const CommentsThread: React.FC<{
  parentPostId: string;
  parentCommentId: string | null;
  isLoggedIn: boolean;
  level: number;
  onReplyTo: (replyTo: string) => void;
}> = (props) => {
  const { slug, threadId, postId } = usePageDetails<ThreadPageDetails>();
  const { postCommentsMap } = useThread({ slug, threadId, postId });

  if (!postCommentsMap.has(props.parentPostId)) {
    return <div />;
  }

  const { roots, parentChainMap, parentChildrenMap } = postCommentsMap.get(
    props.parentPostId
  ) as ThreadCommentInfoType;
  let actualRoots = props.parentCommentId
    ? parentChildrenMap.get(props.parentCommentId) || []
    : roots;
  return (
    <>
      {actualRoots.map((comment: CommentType, i: number) => {
        return (
          <CommentsThreadLevel
            key={comment.commentId}
            comment={comment}
            parentChainMap={parentChainMap}
            parentChildrenMap={parentChildrenMap}
            {...props}
          />
        );
      })}
    </>
  );
};

export default CommentsThread;

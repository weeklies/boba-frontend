import React from "react";
import {
  Layout,
  FeedWithMenu,
  Comment,
  ThreadIndent,
  Post,
  // @ts-ignore
} from "@bobaboard/ui-components";
import PostEditorModal from "../../../components/PostEditorModal";
import CommentEditorModal from "../../../components/CommentEditorModal";
import SideMenu from "../../../components/SideMenu";
import { useRouter } from "next/router";
import { getThreadData, getBoardData } from "../../../utils/queries";
import { useQuery } from "react-query";
import { useAuth } from "../../../components/Auth";
import LoginModal from "../../../components/LoginModal";
import moment from "moment";
import axios from "axios";

const makePostsTree = (posts: any[]) => {
  if (!posts) {
    return [undefined, {}];
  }
  let root = null;
  const parentChildrenMap: { [key: string]: any } = {};

  posts.forEach((post) => {
    if (!post.parent_post_id) {
      root = post;
      return;
    }
    parentChildrenMap[post.parent_post_id] = [
      post,
      ...(parentChildrenMap[post.parent_post_id] || []),
    ];
  });

  return [root, parentChildrenMap];
};

const getTotalContributions = (post: any, postsMap: { [key: string]: any }) => {
  let total = 0;
  let next = postsMap[post.id];
  while (next && next.length > 0) {
    total += next.length;
    next = next.flatMap((child: any) => (child && postsMap[child.id]) || []);
  }
  return total;
};
const getTotalNewContributions = (
  post: any,
  postsMap: { [key: string]: any }
) => {
  let total = 0;
  let next = postsMap[post.id];
  while (next && next.length > 0) {
    total += next.reduce(
      (value: number, post: any) => value + (post.is_new ? 1 : 0),
      0
    );
    next = next.flatMap((child: any) => (child && postsMap[child.id]) || []);
  }
  return total;
};

const ThreadLevel: React.FC<{
  post: any;
  postsMap: { [key: string]: any };
  level: number;
  onNewComment: (id: string) => void;
  onNewContribution: (id: string) => void;
  isLoggedIn: boolean;
}> = (props) => {
  return (
    <>
      <div className="level">
        <ThreadIndent
          level={props.level}
          key={`${props.level}_${props.post.id}`}
        >
          <div className="post">
            <Post
              key={props.post.id}
              createdTime={moment.utc(props.post.created).fromNow()}
              text={props.post.content}
              secretIdentity={props.post.secret_identity}
              userIdentity={props.post.user_identity}
              onNewContribution={() => props.onNewContribution(props.post.id)}
              onNewComment={() => props.onNewComment(props.post.id)}
              totalComments={props.post.comments?.length}
              directContributions={props.postsMap[props.post.id]?.length}
              totalContributions={getTotalContributions(
                props.post,
                props.postsMap
              )}
              newPost={props.isLoggedIn && props.post.is_new}
              newComments={props.isLoggedIn && props.post.new_comments}
              newContributions={getTotalNewContributions(
                props.post,
                props.postsMap
              )}
              centered={Object.keys(props.postsMap).length == 0}
            />
          </div>
        </ThreadIndent>
        {props.post.comments && (
          <ThreadIndent level={props.level + 1}>
            {props.post.comments.map((comment: any, i: number) => (
              <Comment
                key={`${props.post.id}_${i}`}
                id="1"
                secretIdentity={comment.secret_identity}
                userIdentity={comment.user_identity}
                initialText={comment.content}
              />
            ))}
          </ThreadIndent>
        )}
        {props.postsMap[props.post.id]?.flatMap((post: any) => (
          <ThreadLevel
            key={post.id}
            post={post}
            postsMap={props.postsMap}
            level={props.level + 1}
            onNewComment={props.onNewComment}
            onNewContribution={props.onNewContribution}
            isLoggedIn={props.isLoggedIn}
          />
        ))}
        <style jsx>
          {`
            .level {
              width: 100%;
            }
            .post {
              margin-top: 15px;
            }
          `}
        </style>
      </div>
    </>
  );
};

function HomePage() {
  const [showSidebar, setShowSidebar] = React.useState(false);
  const [postReplyId, setPostReplyId] = React.useState<string | null>(null);
  const [commentReplyId, setCommentReplyId] = React.useState<string | null>(
    null
  );
  const router = useRouter();
  const { isPending, user, isLoggedIn } = useAuth();
  const [loginOpen, setLoginOpen] = React.useState(false);
  const {
    data: threadData,
    // @ts-ignore
    isFetching: isFetchingPosts,
    // @ts-ignore
    error: fetchPostsError,
    refetch: refetchTread,
  } = useQuery(["threadData", { threadId: router.query.id }], getThreadData, {
    refetchOnWindowFocus: false,
  });
  const [[root, postsMap], setPostsTree] = React.useState([undefined, {}]);
  const {
    data: boardData,
    isFetching: isFetchingBoardData,
    // @ts-ignore
    error: boardDataError,
  } = useQuery(
    ["boardData", { slug: router.query.boardId?.slice(1) }],
    getBoardData,
    { staleTime: Infinity }
  );

  React.useEffect(() => {
    console.log(`thread_id:`, router.query.id);
    if (!isPending && isLoggedIn) {
      axios.get(`threads/${router.query.id}/visit`);
    }
  }, [isPending, isLoggedIn]);

  React.useEffect(() => {
    setPostsTree(makePostsTree(threadData?.posts) as any);
  }, [threadData]);

  if (!root || !root) {
    return <div />;
  }

  const slug: string = router.query.boardId?.slice(1) as string;
  return (
    <div className="main">
      <LoginModal
        isOpen={loginOpen}
        onCloseModal={() => setLoginOpen(false)}
        color={
          isFetchingBoardData ? "#f96680" : boardData?.settings?.accentColor
        }
      />
      <PostEditorModal
        isOpen={!!postReplyId}
        secretIdentity={{
          name: "[TBD]",
          avatar: `/tuxedo-mask.jpg`,
        }}
        userIdentity={{
          name: user?.username,
          avatar: user?.avatarUrl,
        }}
        onPostSaved={(post: any) => {
          refetchTread();
          setPostReplyId(null);
        }}
        onCloseModal={() => setPostReplyId(null)}
        submitUrl={`/posts/${postReplyId}/contribute`}
      />
      <CommentEditorModal
        isOpen={!!commentReplyId}
        secretIdentity={{
          name: "[TBD]",
          avatar: `/tuxedo-mask.jpg`,
        }}
        userIdentity={{
          name: user?.username,
          avatar: user?.avatarUrl,
        }}
        onCommentSaved={(comment: any) => {
          refetchTread();
          setCommentReplyId(null);
        }}
        onCloseModal={() => setCommentReplyId(null)}
        submitUrl={`/posts/${commentReplyId}/comment`}
      />
      <Layout
        mainContent={
          <FeedWithMenu
            sidebarContent={<div></div>}
            feedContent={
              <div className="feed-content">
                <ThreadLevel
                  post={root}
                  postsMap={postsMap as any}
                  level={0}
                  onNewComment={(answerTo: string) =>
                    setCommentReplyId(answerTo)
                  }
                  onNewContribution={(answerTo: string) =>
                    setPostReplyId(answerTo)
                  }
                  isLoggedIn={isLoggedIn}
                />
              </div>
            }
          />
        }
        sideMenuContent={<SideMenu />}
        headerAccent={boardData?.settings.accentColor || "#f96680"}
        title={`!${slug}`}
        onTitleClick={() => {
          setShowSidebar(!showSidebar);
        }}
        onUserBarClick={() => setLoginOpen(true)}
        user={user}
        loading={isPending}
      />
      <style jsx>
        {`
          .feed-content {
            max-width: 100%;
          }
        `}
      </style>
    </div>
  );
}

export default HomePage;

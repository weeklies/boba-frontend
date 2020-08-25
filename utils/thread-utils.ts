import debug from "debug";
import { PostType, CommentType } from "../types/Types";
const log = debug("bobafrontend:thread-utils");

export const makeCommentsTree = (
  comments: CommentType[] | undefined,
  parentCommentId: string | null,
  postId: string
) => {
  log(`Creating comments tree for post ${postId}`);
  const result = {
    roots: [] as CommentType[],
    parentChainMap: new Map<string, CommentType>(),
    parentChildrenMap: new Map<string, CommentType[]>(),
  };
  if (!comments) {
    return result;
  }
  comments.forEach((comment) => {
    if (comment.parentCommentId == parentCommentId && !comment.chainParentId) {
      result.roots.push(comment);
      return;
    }
    if (comment.parentCommentId) {
      result.parentChildrenMap.set(comment.parentCommentId, [
        ...(result.parentChildrenMap.get(comment.parentCommentId) ||
          ([] as CommentType[])),
        comment,
      ]);
    }
    if (comment.chainParentId) {
      result.parentChainMap.set(comment.chainParentId, comment);
    }
  });

  log(`Created comment tree:`);
  log(result);
  return result;
};

// Transform the array of posts received from the server in a tree
// representation. The return value is comprised of two values:
// the root value is the top post of the thread; the parentChildrenMap
// value is a Map from the string id of a post to its direct children.
export const makePostsTree = (
  posts: PostType[] | undefined,
  threadId: string
) => {
  log(`Creating posts tree for thread ${threadId}`);
  if (!posts) {
    return {
      root: undefined,
      parentChildrenMap: new Map<
        string,
        { children: PostType[]; parent: PostType | null }
      >(),
    };
  }
  let root: PostType | null = null;
  const parentChildrenMap = new Map<
    string,
    { children: PostType[]; parent: PostType | null }
  >();
  const postsDisplaySequence: PostType[] = [];

  posts.forEach((post) => {
    if (!post.parentPostId) {
      root = post;
      return;
    }
    const parent =
      posts.find((parentCandidate) => parentCandidate.postId == post.postId) ||
      null;
    parentChildrenMap.set(post.parentPostId, {
      parent,
      children: [
        ...(parentChildrenMap.get(post.parentPostId)?.children ||
          ([] as PostType[])),
        post,
      ],
    });
  });

  if (root) {
    const postsStacks: PostType[] = [root];
    while (postsStacks.length) {
      const currentPost = postsStacks.pop() as PostType;
      postsDisplaySequence.push(currentPost);

      const children = parentChildrenMap.get(currentPost.postId)?.children;
      if (!children) {
        continue;
      }
      for (let i = children.length - 1; i >= 0; i--) {
        postsStacks.push(children[i]);
      }
    }
  }

  return { root, parentChildrenMap, postsDisplaySequence };
};

export const getTotalContributions = (
  post: PostType,
  postsMap: Map<string, { children: PostType[]; parent: PostType | null }>
) => {
  let total = 0;
  let next = postsMap.get(post.postId)?.children;
  while (next && next.length > 0) {
    total += next.length;
    next = next.flatMap(
      (child: PostType) => (child && postsMap.get(child.postId)?.children) || []
    );
  }
  return total;
};

export const getTotalNewContributions = (
  post: PostType,
  postsMap: Map<string, { children: PostType[]; parent: PostType | null }>
) => {
  let total = 0;
  let next = postsMap.get(post.postId)?.children;
  while (next && next.length > 0) {
    total += next.reduce(
      (value: number, post: PostType) => value + (post.isNew ? 1 : 0),
      0
    );
    next = next.flatMap(
      (child: PostType) => (child && postsMap.get(child.postId)?.children) || []
    );
  }
  return total;
};

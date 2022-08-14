import * as Util from './Utils.js';
import * as User from './User.js';
const articlesTable = Util.getTableName('articles');
/**
 * @module Article
 */

async function create(event) {
  const authenticatedUser = await User.authenticateAndGetUser(event);
  if (!authenticatedUser) {
    return Util.envelop('Must be logged in.', 422);
  }

  const body = JSON.parse(event.body);
  if (!body.article) {
    return Util.envelop('Article must be specified.', 422);
  }

  const articleData = body.article;
  for (const expectedField of ['title', 'description', 'body']) {
    if (!articleData[expectedField]) {
      return Util.envelop(`${expectedField} must be specified.`, 422);
    }
  }
  const timestamp = new Date().getTime();
  const slug =
    slugify(articleData.title) +
    '-' +
    ((Math.random() * Math.pow(36, 6)) | 0).toString(36);
  const article = {
    slug,
    title: articleData.title,
    description: articleData.description,
    body: articleData.body,
    createdAt: timestamp,
    updatedAt: timestamp,
    author: authenticatedUser.username,
    dummy: 'OK',
  };
  if (articleData.tagList) {
    article.tagList = Util.DocumentClient.createSet(articleData.tagList);
  }

  await Util.getDocumentClient()
    .put({
      TableName: articlesTable,
      Item: article,
    })
    .promise();

  delete article.dummy;
  article.tagList = articleData.tagList || [];
  article.favorited = false;
  article.favoritesCount = 0;
  article.author = {
    username: authenticatedUser.username,
    bio: authenticatedUser.bio || '',
    image: authenticatedUser.image || '',
    following: false,
  };

  return Util.envelop({ article });
}
async function get(event) {
  const slug = event.pathParameters.slug;
  /* istanbul ignore if  */
  if (!slug) {
    return Util.envelop('Slug must be specified.', 422);
  }
  const article = (
    await Util.getDocumentClient().get({
      TableName: articlesTable,
      Key: { slug },
    })
  ).Item;
  if (!article) {
    return Util.envelop(`Article not found: [${slug}]`, 422);
  }
  const authenticatedUser = await User.authenticateAndGetUser(event);
  return Util.envelop({
    article: await transformRetrievedArticle(article, authenticatedUser),
  });
}

/** Update article */
async function update(event) {
  const body = JSON.parse(event.body);
  const articleMutation = body.article;
  if (!articleMutation) {
    return Util.envelop('Article mutation must be specified.', 422);
  }
  // Ensure at least one mutation is requested
  if (!article.title && !articleMutation.description && !articleMutation.body) {
    return Util.envelop(
      'At least one field must be specified: [title, description, article].',
      422
    );
  }
  const authenticatedUser = await User.authenticateAndGetUser(event);
  if (!authenticatedUser) {
    return Util.envelop('Must be logged in.', 422);
  }
  const slug = event.pathParameters.slug;
  /* istanbul ignore if  */
  if (!slug) {
    return Util.envelop('Slug must be specified.', 422);
  }

  const article = (
    await Util.getDocumentClient()
      .get({
        TableName: articlesTable,
        Key: { slug: slug },
      })
      .promise()
  ).Item;
  if (!article) {
    return Util.envelop(`Article not found: [${slug}]`, 422);
  }

  // Ensure article is authored by authenticatedUser
  if (article.author !== authenticatedUser.username) {
    return Util.envelop(
      'Article can only be updated by author: ' + `[${article.author}]`,
      422
    );
  }

  // Apply mutations to retrieved article
  ['title', 'description', 'body'].forEach((field) => {
    if (articleMutation[field]) {
      article[field] = articleMutation[field];
    }
  });
  await Util.DocumentClient.put({
    TableName: articlesTable,
    Item: article,
  }).promise();

  const updatedArticle = (
    await Util.DocumentClient.get({
      TableName: articlesTable,
      Key: { slug },
    }).promise()
  ).Item;

  return Util.envelop({
    article: await transformRetrievedArticle(updatedArticle, authenticatedUser),
  });
}

async function deleteArticles(event) {}
async function favorite(event) {}
async function list(event) {}
async function getFeed(event) {}
async function getTags(event) {}

async function queryEnoughArticles(
  queryParams,
  authenticatedUser,
  limit,
  offset
) {}

/**
 * Given an article retrieved from table,
 * decorate it with extra information like author, favorite, following etc.
 */
async function transformRetrievedArticle(article, authenticatedUser) {
  delete article.dummy;
  article.tagList = article.tagList ? article.tagList.values : [];
  article.favoritesCount = article.favoritesCount || 0;
  article.favorited = false;
  if (article.favoritedBy && authenticatedUser) {
    article.favorited = article.favoritedBy.includes(
      authenticatedUser.username
    );
    delete article.favoritedBy;
  }
  article.author = await User.getProfileByUsername(
    article.author,
    authenticatedUser
  );
}

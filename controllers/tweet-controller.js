const { Like, Reply, Tweet, User } = require('../models')
// const { getUser } = require('../helpers/auth-helpers')
const { getUser } = require('../_helpers')

const tweetController = {
  postTweet: (req, res, next) => {
    const { description } = req.body
    // if (!description.trim()) return res.status(400).json({ message: '推文不能為空白' })
    // if (description.length > 140) return res.status(400).json({ message: '推文字數限制在 140 以內' })
    User.findByPk(getUser(req).dataValues.id)
      .then(user => {
        if (!user) throw new Error('Can not find this user.')
        return Tweet.create({
          UserId: user.id,
          description
        })
      })
      .then(tweet => {
        return res.status(200).json({ success: true, tweet })
      })
      .catch(err => next(err))
  },
  getTweets: (req, res, next) => {
    const currentUser = getUser(req)
    return Tweet.findAll({
      include: [
        { model: User, attributes: ['id', 'account', 'name', 'avatar'] },
        { model: Reply },
        { model: Like }
      ],
      order: [['createdAt', 'DESC']]
    })
      .then(tweets => {
        const data = tweets.map(t => {
          t = t.toJSON()
          if (currentUser.Likes) {
            t.currentUserLikes = currentUser.Likes.some(l => l.TweetId === t.id)
            t.replyCounts = t.Replies.length
            t.likeCounts = t.Likes.length
          }
          delete t.Replies
          delete t.Likes
          return t
        })
        return res.status(200).json(data)
      })
      .catch(err => next(err))
  },
  getTweet: (req, res, next) => {
    const currentUser = getUser(req)
    return Tweet.findByPk(req.params.id, {
      include: [
        { model: User, attributes: ['id', 'avatar', 'name', 'account'] },
        { model: Reply, include: { model: User, attributes: ['id', 'avatar', 'name', 'account'] } },
        { model: Like, attributes: ['id'] }
      ],
      order: [
        [{ model: Reply }, 'createdAt', 'DESC']
      ]
    })
      .then(tweet => {
        if (!tweet) throw new Error('推文不存在')
        tweet = tweet.toJSON()
        if (currentUser.Likes) {
          tweet.currentUserLikes = currentUser.Likes.some(l => l.TweetId === tweet.id)
          tweet.replyCounts = tweet.Replies.length
          tweet.likeCounts = tweet.Likes.length
        }
        delete tweet.Likes
        return res.status(200).json(tweet)
      })
      .catch(err => next(err))
  },
  postReply: (req, res, next) => {
    const { comment } = req.body
    if (!comment.trim()) return res.status(400).json({ message: '回覆內容不能空白' })
    Tweet.findByPk(req.params.tweet_id, {
      include: { model: User }
    })
      .then(tweet => {
        if (!tweet) throw new Error('推文不存在')
        return Reply.create({
          UserId: getUser(req).dataValues.id,
          TweetId: tweet.id,
          comment
        })
      })
      .then(reply => {
        // return res.status(200).json({ status: 'success', reply }) // 前端說改成下面
        return res.status(200).json({ success: true, reply })
      })
      .catch(err => next(err))
  },
  getReply: (req, res, next) => {
    return Tweet.findByPk(req.params.tweet_id)
      .then(tweet => {
        if (!tweet) throw new Error('推文不存在')
        return Reply.findAll(
          { where: { TweetId: tweet.id } }
        )
      })
      .then(replies => {
        const data = []
        replies.forEach(reply => data.push(reply))
        return res.status(200).json(data)
      })
      .catch(err => next(err))
  }
}

module.exports = tweetController

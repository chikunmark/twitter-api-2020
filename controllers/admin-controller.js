const { sequelize } = require('../models')

const adminController = {
  getUsers: (req, res, next) => {
    sequelize.query(
        `SELECT 
        Users.id, Users.email, Users.account, Users.name, Tweets.user_id, 
        COUNT(Likes.user_id) AS liked_count, 
        COUNT(description) AS tweet_count FROM Tweets
        LEFT JOIN Users ON Users.id = Tweets.user_id
        LEFT JOIN Likes ON Likes.tweet_id = Tweets.id
       LEFT JOIN (
          SELECT
          Users.id, 
          COUNT(following_id) AS following_count
          FROM Followships
          LEFT JOIN Users ON Users.id = Followships.follower_id
          GROUP BY follower_id
          ) AS x ON x.id = Tweets.user_id
          LEFT JOIN (
          SELECT
          Users.id,
          COUNT(follower_id) AS follower_count
          FROM Followships
          LEFT JOIN Users ON Users.id = Followships.following_id
          GROUP BY following_id
          ) AS y ON y.id = Tweets.user_id
        GROUP BY Tweets.user_id, following_count, follower_count`
    )
      .then(data => {
        res.status(200).json(data[0])
      })
      .catch(err => next(err))
  }
}

module.exports = adminController

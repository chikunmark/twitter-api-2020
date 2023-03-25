const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs') // 教案 package.json 用 bcrypt-node.js，不管，我先用舊的 add-on
const { User, Tweet, Reply, Like, Followship } = require('../models')
const { imgurFileHandler } = require('../helpers/file-helpers')
const helpers = require('../_helpers')

const userController = {
  signIn: (req, res, next) => {
    try {
      const userData = req.user.toJSON()
      delete userData.password // 刪除 .password 這個 property
      // (下1) 發出 jwt token，要擺兩個引數，第一個，要包進去的資料，第二個，要放 secret key
      const token = jwt.sign(userData, process.env.JWT_SECRET, { expiresIn: '30d' }) // 30 天過期，可調
      res.json({ status: 'success', data: { token, user: userData } })
    } catch (err) {
      next(err)
    }
  },
  signUp: (req, res, next) => {
    // (下1) 測試檔不給過，先 comment，之後刪
    // if (req.body.password !== req.body.passwordCheck) throw new Error('Passwords do not match!')
    if (req.body.name.length > 50) throw new Error('name 字數大於 50')

    return Promise.all([
      User.findOne({ where: { email: req.body.email } }),
      User.findOne({ where: { account: req.body.account } })
    ])
      .then(([emailResult, accountResult]) => {
        if (emailResult && accountResult) throw new Error('email 與 account 都重複註冊！')
        if (emailResult) throw new Error('email 已重複註冊！')
        if (accountResult) throw new Error('account 已重複註冊！')
      })
      .then(() => bcrypt.hash(req.body.password, 10))
      .then(hash =>
        User.create({
          account: req.body.account,
          name: req.body.name,
          email: req.body.email,
          password: hash
        })
      )
      .then(createdUser => {
        const result = createdUser.toJSON()
        delete result.password // 避免不必要資料外洩
        res.status(200).json({ status: 'success', user: result })
      })
      .catch(err => next(err))
  },
  getUserInfo: (req, res, next) => {
    return User.findByPk(req.params.id, { raw: true })
      .then(user => {
        if (!user) return res.status(404).json({ message: 'Can not find this user.' })
        delete user.password
        // return res.status(200).json({ status: 'success', user })
        // 因為測試檔，所以物件格式不能像 (上1) 一樣加工，必須做成 (下1)
        return res.status(200).json(user)
      })
      .catch(err => next(err))
  },
  putUser: (req, res, next) => {
    const id = Number(req.params.id)
    const oldPW = helpers.getUser(req).password
    // if (req.user.id !== id) {
    // (上1 不能用) 居然得為了測試擋改成這樣 (下1)
    if (helpers.getUser(req).id !== id) {
      return res.status(401).json({
        status: 'error',
        message: 'Sorry. You do not own this account.'
      })
    }
    // 檢驗每個 key/value
    for (const key in req.body) {
      if (!req.body[key].trim()) throw new Error(`${key} 不能輸入空白`)
    }
    // const { file } = req
    const { files } = req // 上傳多個檔時，會改擺在 req.files
    // 必須先知道有哪些要更動 (變數量可能有變!!)
    let { account, email, password } = req.body // 管他有沒有都先設，之後確保正確使用就好
    if (account === helpers.getUser(req).account) {
      account = undefined
    }
    if (email === helpers.getUser(req).email) {
      email = undefined
    }
    const upload = {}
    for (const key in files) {
      upload[key] = { path: files[key][0].path }
    }
    return Promise.all([
      imgurFileHandler(upload.image), // 若有餘裕，就研究下圖片上傳的細節唄
      imgurFileHandler(upload.avatar),
      User.findByPk(id),
      // (下1) false 要擺 account 根本不存在 (不更動 account) 的狀況
      account ? User.findOne({ where: { account } }) : undefined,
      email ? User.findOne({ where: { email } }) : undefined,
      // password ? bcrypt.compare(password, oldPW) : oldPW
      password ? bcrypt.compare(password, oldPW) : true
      // (上1) 因為測試檔 pw 是 null，若用 oldPW，下面的判定會跑到 else，拿空值去雜湊，跳 illegal argument，所以這樣改
    ])
      .then(([imagePath, avatarPath, user, sameAcc, sameMail, samePW]) => {
        if (!user) throw new Error("User doesn't exist!")
        if (sameAcc) throw new Error('account 已重複註冊！')
        if (sameMail) throw new Error('email 已重複註冊！')
        if (samePW) {
          req.body.password = oldPW
        } else {
          bcrypt.hash(password, 10).then(password => user.update({ password }))
        }
        req.body.account = account
        req.body.email = email
        req.body.image = imagePath || user.image
        req.body.avatar = avatarPath || user.avatar
        return user.update(req.body) // 試試看唄，看能不能回傳 array
      })
      .then(updatedUser => {
        const result = updatedUser.toJSON()
        delete result.password
        return res.status(200).json(result)
      })
      .catch(err => next(err))
  },
  getTweets: (req, res, next) => {
    return Tweet.findAll({
      where: { UserId: req.params.id }, // 為了測試檔而改成這樣
      raw: true,
      order: [['createdAt', 'DESC']]
    })
      .then(tweets => res.status(200).json(tweets))
      .catch(err => next(err))
  },
  getReplies: (req, res, next) => {
    return Reply.findAll({
      where: { UserId: req.params.id }, // 因測試檔，改大駝峰
      raw: true,
      order: [['createdAt', 'DESC']]
    })
      .then(replies => res.status(200).json(replies))
      .catch(err => next(err))
  },
  getLikes: (req, res, next) => {
    return Like.findAll({
      where: { UserId: req.params.id }, // 因測試檔，改大駝峰
      raw: true,
      order: [['createdAt', 'DESC']]
    })
      .then(likes => res.status(200).json(likes))
      .catch(err => next(err))
  },
  getFollowings: (req, res, next) => {
    return Followship.findAll({
      where: { followerId: req.params.id },
      order: [['createdAt', 'DESC']]
    })
      // (下1) 沒做 toJSON() 處理也能輸出正常 json 檔，但得注意
      .then(followings => res.status(200).json(followings))
      .catch(err => next(err))
  },
  getFollowers: (req, res, next) => {
    return Followship.findAll({
      where: { followingId: req.params.id },
      order: [['createdAt', 'DESC']]
    })
      // (下1) 沒做 toJSON() 處理也能輸出正常 json 檔，但得注意
      .then(followers => res.status(200).json(followers))
      .catch(err => next(err))
  },
  addFollowing: (req, res, next) => {
    const followingId = Number(req.body.id) // 要 follow 的對象
    return User.findByPk(helpers.getUser(req).id) // 登入的使用者
      .then(user => {
        // if (!user || !userId) {
        //   return res.status(404).json({ status: 'error', message: 'Cannot find this user' })
        // }
        // if (user.id === userId) throw new Error('不能追蹤自己')
        return Followship.create({
          followerId: user.id,
          followingId
        })
      })
      .then(following => {
        // if (following) return res.status(409).json({ status: 'error', message: 'you already followed this user.' })
        return res.status(200).json(following)
      })
      .catch(err => next(err))
  },
  removeFollowing: (req, res, next) => {
    const { followingId } = req.params
    return User.findByPk(helpers.getUser(req).id)
      .then(user => Followship.findOne({ where: { followerId: user.id, followingId } }))
      .then(following => {
        following.destroy()
        return res.status(200).json({ message: 'success', following })
      })
      .catch(err => next(err))
  },
  // getFollowship: (req, res, next) => {

  // },
  addLike: (req, res, next) => {
    const TweetId = req.params.id
    // return User.findOne(helpers.getUser(req).id)
    // return User.findOne(getUser(req).id)
    return User.findByPk(helpers.getUser(req).id)
      .then(user => Like.create({ UserId: user.id, TweetId }))
      .then(like => res.status(200).json({ message: 'success', like }))
      .catch(err => next(err))
  },
  removeLike: (req, res, next) => {
    const { id } = req.params
    return Like.findByPk(id)
      .then(like => {
        if (!like) return res.status(404).json({ message: 'We can not find this like record.' })
        return like.destroy()
      })
      .then(like => res.status(200).json({ message: 'success', like }))
      .catch(err => next(err))
      // to 子安：因為要過測試檔，我把你的 (下面)，改成上面了
    // return User.findByPk(helpers.getUser(req).id)
    //   .then(user => {
    //     return Like.findOne({
    //       where: {
    //         UserId: user.id,
    //         TweetId
    //       }
    //     })
    //   })
    //   .then(like => {
    //     like.destroy()
    //     return res.status(200).json({ message: 'success', like })
    //   })
      // .catch(err => next(err))
  }
}

module.exports = userController

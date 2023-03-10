require('dotenv').config()

const express = require('express')
const cookieParser = require('cookie-parser')
const logger = require('morgan')

const postsRouter = require('./routes/posts')

const app = express()

app.use(logger('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use('/', postsRouter)

app.listen(3000, () => {
  console.log('App listening on port 3000')
})

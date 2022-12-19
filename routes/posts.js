const express = require('express')
const { Client } = require('@notionhq/client')
const { NotionToMarkdown } = require('notion-to-md')
const router = express.Router()

const notion = new Client({ // cliente notion
  auth: process.env.TOKEN
})

function filterDate (dateStr) { // transforma o formato da data de yyyy-mm-dd para dd/mm/yyyy
  const newDate = dateStr.split('-')

  const aux = newDate[0]
  newDate[0] = newDate[2]
  newDate[2] = aux

  return newDate.join('/')
}

router.get('/posts', async function (req, res, next) { // listar todos os posts
  const and = [{ // filtro para retornar apenas os posts publicados
    property: 'publicado',
    checkbox: {
      equals: true
    }
  }]

  const or = {
    or: []
  }

  if (req.query.tags) { // pesquisa por tags
    const tags = req.query.tags.split('+')

    for (const tag of tags) {
      or.or.push({
        property: 'tags',
        multi_select: {
          contains: tag
        }
      })
    }
  }

  if (or.or.length !== 0) {
    and.push(or)
  }

  notion.databases.query({ // query na base de dados no notion
    database_id: process.env.POSTS_DB_ID,
    filter: {
      and
    },
    sorts: [{
      property: 'data_publicado',
      direction: 'ascending'
    }]
  }).then((data) => {
    const page = parseInt(req.query.page)
    const pagesize = parseInt(req.query.pagesize)
    const paginated = data.results.slice((page - 1) * pagesize, page * pagesize) // paginação

    console.log((page - 1) * pagesize, page * pagesize)

    if (paginated.length === 0) { // caso de busca vazia
      res.send({
        msg: 'A busca não encontrou resultados'
      })
    } else { // recupera os dados da resposta da api do notion e refatora para um formato mais adequado para exibição no front
      const response = []

      paginated.forEach(post => {
        response.push({
          id: post.id,
          cover: post.cover.external.url,
          name: post.properties.nome.title[0].plain_text,
          link: post.properties.link_legivel.rich_text[0].plain_text,
          date: filterDate(post.properties.data_publicado.date.start),
          subtitle: post.properties.subtitulo.rich_text[0].plain_text,
          tags: post.properties.tags.multi_select
        })
      })

      res.send({
        msg: 'Busca realizada com sucesso',
        response
      })
    }
  }).catch((err) => {
    res.statusCode = 500
    console.log(err)
    res.send({
      err: err.code,
      msg: 'Ocorreu um erro com os filtros, tente novamente'
    })
  })
})

router.get('/posts/:link', async function (req, res, next) {
  console.log(req.params)

  notion.databases.query({ // query na base de dados no notion
    database_id: process.env.POSTS_DB_ID,
    filter: {
      and: [
        { // filtro para retornar apenas os posts publicados
          property: 'publicado',
          checkbox: {
            equals: true
          }
        },
        {
          property: 'link_legivel',
          rich_text: {
            contains: req.params.link
          }
        }
      ]
    },
    sorts: [{
      property: 'data_publicado',
      direction: 'ascending'
    }]
  }).then(data => {
    if (data.results.length === 0) {
      res.send({ msg: 'Post não existe' })
      return
    }

    const pageDetails = {
      id: data.results[0].id,
      cover: data.results[0].cover.external.url,
      name: data.results[0].properties.nome.title[0].plain_text,
      date: filterDate(data.results[0].properties.data_publicado.date.start),
      tags: data.results[0].properties.tags.multi_select,
      subtitle: data.results[0].properties.subtitulo.rich_text[0].plain_text,
      md: '',
      autor: {
        nome: data.results[0].properties.autor.created_by.name,
        foto: data.results[0].properties.autor.created_by.avatar_url
      }
    }

    const n2m = new NotionToMarkdown({ notionClient: notion })

    n2m.pageToMarkdown(data.results[0].id)
      .then(data => {
        pageDetails.md = n2m.toMarkdownString(data)
        res.send(pageDetails)
      })
      .catch(err => {
        res.statusCode = 500
        res.send({
          err: err.code,
          msg: 'Ocorreu um erro, tente novamente'
        })
      })
  }).catch(err => {
    console.log(err)
    res.statusCode = 500
    res.send({
      err: err.code,
      msg: 'Ocorreu um erro, tente novamente'
    })
  })
})

module.exports = router

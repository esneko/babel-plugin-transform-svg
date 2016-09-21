import HTMLDOMPropertyConfig from 'react/lib/HTMLDOMPropertyConfig'
import SVGDOMPropertyConfig from 'react/lib/SVGDOMPropertyConfig'
import {dirname, resolve} from 'path'
import {readFileSync} from 'fs'
import parse from 'xml-parser'

const allowed = []
const restricted = {
  svg: ['style', 'height', 'width']
}

Object.keys(HTMLDOMPropertyConfig.DOMAttributeNames).forEach(reactName => {
  allowed[HTMLDOMPropertyConfig.DOMAttributeNames[reactName]] = reactName
})
Object.keys(SVGDOMPropertyConfig.DOMAttributeNames).forEach(reactName => {
  allowed[SVGDOMPropertyConfig.DOMAttributeNames[reactName]] = reactName
})
Object.keys(HTMLDOMPropertyConfig.Properties).forEach(name => {
  allowed[name] = name
})
Object.keys(SVGDOMPropertyConfig.Properties).forEach(name => {
  allowed[name] = name
})

export default ({types: t}) => ({
  visitor: {
    ImportDeclaration: {
      exit: (path, state) => {
        const compiler = (id, node) => {
          const attributes = []

          Object.keys(node.attributes).forEach(name => {
            if (allowed[name] && (!restricted[node.name] || restricted[node.name].indexOf(name) === -1)) {
              attributes.push(
                svgAttribute(allowed[name], node.attributes[name])
              )
            }
          })

          if (node.name === 'svg') {
            attributes.push(
              svgAttribute('className', id.replace( /([a-z])([A-Z])/g, '$1-$2' ).toLowerCase())
            )
          }

          let children = node.children.map(child => compiler(null, child))

          if (node.name === 'style') {
            children = [t.JSXText(node.content)]
          }
          return svgElement(node, attributes, children)
        }

        const svgAttribute = (name, value) =>
          t.JSXAttribute(
            t.JSXIdentifier(name),
            t.stringLiteral(value)
          )

        const svgElement = (node, attributes = [], children = []) =>
          t.JSXElement(
            t.JSXOpeningElement(t.JSXIdentifier(node.name), attributes),
            t.JSXClosingElement(t.JSXIdentifier(node.name)),
            children
          )

        const reactComponent = (id, root) =>
          t.functionDeclaration(
            t.identifier(id),
            [t.identifier('props')],
            t.blockStatement(
              [t.returnStatement(
                compiler(id, root)
              )]
            )
          )

        const target = path.node.source.value

        if (/svg$/.test(target)) {
          const id = path.node.specifiers[0].local.name
          const dir = dirname(resolve(state.file.opts.filename))
          const absolutePath = resolve(dir, target)

          const xml = parse(
            readFileSync(absolutePath).toString('utf-8')
          )

          path.replaceWith(reactComponent(id, xml.root))
        }
      }
    }
  }
})

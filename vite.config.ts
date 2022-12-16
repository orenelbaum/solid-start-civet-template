import solid from 'solid-start/vite'
import { type Plugin, defineConfig } from 'vite'
import { load as loadHTML } from 'cheerio'
import { createFilter, type FilterPattern } from '@rollup/pluginutils'
import civet from '@danielx/civet'

interface PluginOptions {
  outputTransformerPlugin?: string
  outputExtension?: string
  stripTypes?: boolean
  include?: FilterPattern
  exclude?: FilterPattern
}

function civetPlugin(pluginOpts: PluginOptions = {}): Plugin {
  const filter = createFilter(
    pluginOpts.include ?? '**/*.civet',
    pluginOpts.exclude ?? 'node_modules/**'
  )
  let parentPlugin: Plugin | undefined
  const stripTypes =
    pluginOpts.stripTypes ?? !pluginOpts.outputTransformerPlugin
  const outputExtension = pluginOpts.outputExtension ?? (stripTypes ? '.js' : '.ts')

  return {
    enforce: 'pre',
    name: 'vite:civet',
    configResolved(resolvedConfig) {
      const parentPluginId = pluginOpts.outputTransformerPlugin
      if (parentPluginId) {
        parentPlugin = resolvedConfig.plugins?.find((it) => it.name === parentPluginId)
        if (!parentPlugin) {
          throw new Error(
            `Unable to find plugin for specified outputTransformerPluginId: ${parentPluginId}: Is it added in vite config before vite-plugin-civet ?`
          )
        }
      }
    },

    transformIndexHtml(html: string) {
      const $ = loadHTML(html)
      $('script').each(function () {
        const el = $(this)
        const src = el.attr('src')
        if (src?.match(/\.civet$/)) {
          el.attr('src', src.replace(/\.civet$/, '.civet.js?transform'))
        }
      })
      return $.html()
    },

    async resolveId(id, importer, options) {
      if (id.match(/\.civet/)) {
        const [pathPart, queryPart] = id.split('?')
        if (pathPart.match(/\.civet\.js$/) && queryPart === 'transform') {
          const transformedId = pathPart.replace(/\.js$/, '')
          const resolution = await this.resolve(
            transformedId,
            importer,
            options
          )
          return resolution?.id
        }
      }
    },

    async transform(code, id, options) {
      if (!filter(id)) return null
      const ast = civet.parse(code)
      const output = civet.generate(ast, {
        js: !stripTypes,
        sourceMap: false,
      })
      if (parentPlugin?.transform) {
        const transformed = await parentPlugin.transform.apply(this, [
          output,
          `${id}.${outputExtension}`,
          options,
        ])
        if (transformed == null) {
          console.warn(
            `Parent plugin ${parentPlugin.name} refused to transform output of vite-plugin-civet`
          )
          return output
        }
        return transformed
      }
      return output
    },
  }
}

export default defineConfig({
  plugins: [
    civetPlugin({
      stripTypes: false,
      outputExtension: 'tsx',
      outputTransformerPlugin: 'solid',
    }),
    solid({
      extensions: ['.civet'],
      rootEntry: '~/root.civet',
    }),
  ],
})

import solid from 'solid-start/vite'
import { defineConfig, PluginOption } from 'vite'
import civetPlugin from 'vite-plugin-civet'

export default defineConfig({
  plugins: [
    {
      ...civetPlugin({
        stripTypes: false,
        outputExtension: 'tsx',
        outputTransformerPlugin: 'solid',
      }) as PluginOption,
      enforce: 'pre',
    },
    solid({
      extensions: ['.civet'],
      rootEntry: '~/root.civet',
    }),
  ],
})

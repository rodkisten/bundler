import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
  reporters: [
       'verbose',
      ['github-actions', {
        jobSummary: {
          outputPath: '/home/runner/jobs/summary/step',
        },
      }],
    ],
})

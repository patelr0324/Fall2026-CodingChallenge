import { createTheme, type MantineColorsTuple } from '@mantine/core'

const coral: MantineColorsTuple = [
  '#fff4f0',
  '#ffe0d6',
  '#ffc0ae',
  '#f79a7d',
  '#e86a4a',
  '#d45535',
  '#b9442a',
  '#983722',
  '#7a2d1c',
  '#632517',
]

export const lumenTheme = createTheme({
  primaryColor: 'coral',
  colors: { coral },
  fontFamily: '"Space Grotesk", system-ui, sans-serif',
  headings: {
    fontFamily: '"Syne", system-ui, sans-serif',
    fontWeight: '700',
  },
  defaultRadius: 'md',
  black: '#121212',
  white: '#f2efe8',
  other: {
    coral: '#e86a4a',
    teal: '#6eb8ad',
    lavender: '#b8a4ff',
  },
})

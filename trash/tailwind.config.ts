import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontSize: {
        'page-title': '27px',
        'section-title': '24px',
        'content': '22px',
        'button': '22px',
      },
      colors: {
        panda: {
          50: '#fef7e8',
          500: '#facc15',
          600: '#eab308',
          700: '#ca8a04'
        }
      },
      fontFamily: {
        'panda': ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}

export default config

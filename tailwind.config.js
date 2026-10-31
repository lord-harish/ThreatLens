/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    borderRadius: {
      'none': '0px',
      'xs': '2px',
      'sm': '3px',
      'DEFAULT': '4px',
      'md': '4px',
      'lg': '6px',
    },
    boxShadow: {
      'none': 'none',
      'border': '0 0 0 1px rgba(215, 196, 203, 0.6)',
    },
    fontFamily: {
      sans: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif'
      ],
      mono: [
        '"SFMono-Regular"',
        'Consolas',
        '"Liberation Mono"',
        'Menlo',
        'Courier',
        'monospace'
      ]
    },
    extend: {
      colors: {
        app: {
          bg: '#f7f1f3',
          surface: '#fefcfd',
          panel: '#fbf7f8',
          subtle: '#f2e8ec',
          border: '#decdd4',
          borderStrong: '#c9b3bc',
          text: '#0f172a',
          muted: '#475569',
          faint: '#64748b',
          accent: '#0369a1',
          accentHover: '#0284c7',
          accentLight: '#e0f2fe',
          accentBorder: '#bae6fd',
          roseDark: '#9f1239',
          roseLight: '#ffe4e6',
          amberDark: '#b45309',
          amberLight: '#fef3c7',
          emeraldDark: '#047857',
          emeraldLight: '#d1fae5'
        }
      }
    },
  },
  plugins: [],
}

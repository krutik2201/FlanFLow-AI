/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#1e293b', // dark slate text
          300: '#334155', // headers / active text
          400: '#475569', // description text
          500: '#2563eb', // primary blue (high contrast)
          600: '#1d4ed8', // hover / active background
          700: '#1e3a8a',
          800: '#0f172a',
          900: '#090d16',
          950: '#090d16',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        surface: {
          900: '#ffffff', // pristine white
          800: '#f8fafc', // header / sidebar bg
          700: '#f1f5f9', // input / card backgrounds
          600: '#e2e8f0', // borders / tracks
          500: '#cbd5e1',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

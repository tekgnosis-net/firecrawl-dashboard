export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'apple-bg': 'var(--apple-bg)',
        'apple-card': 'var(--apple-card)',
        'apple-text': 'var(--apple-text)',
        'apple-text-secondary': 'var(--apple-text-secondary)',
        'apple-blue': 'var(--apple-blue)',
        'apple-green': 'var(--apple-green)',
        'apple-red': 'var(--apple-red)',
        'apple-gray': 'var(--apple-gray)',
        'apple-separator': 'var(--apple-separator)',
      },
      borderRadius: {
        'apple': '12px',
        'apple-lg': '16px',
        'apple-xl': '20px',
      },
      boxShadow: {
        'apple': '0 2px 8px var(--apple-shadow)',
        'apple-card': '0 4px 12px var(--apple-shadow-card)',
      },
    },
  },
  plugins: [],
}

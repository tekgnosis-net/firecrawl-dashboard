export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'apple-bg': '#F5F5F7', 'apple-card': '#FFFFFF', 'apple-text': '#1D1D1F',
        'apple-text-secondary': '#86868B', 'apple-blue': '#0071E3',
        'apple-green': '#34C759', 'apple-red': '#FF3B30', 'apple-gray': '#8E8E93',
        'apple-separator': '#D2D2D7',
      },
      borderRadius: { 'apple': '12px', 'apple-lg': '16px', 'apple-xl': '20px' },
      boxShadow: {
        'apple': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'apple-card': '0 4px 12px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}
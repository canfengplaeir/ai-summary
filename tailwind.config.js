/** @type {import('tailwindcss').Config} */
export default {
  content: ["./templates/**/*.{html,js}", "./static/**/*.{css,js}"],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui'),],
}


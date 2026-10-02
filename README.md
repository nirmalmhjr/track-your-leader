# Next.js Front-end Template

![Next.js](https://img.shields.io/badge/Next.js-15-green)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.0-blueviolet)
![ESLint](https://img.shields.io/badge/ESLint-Configured-yellow)
![Prettier](https://img.shields.io/badge/Prettier-Configured-lightgrey)
![Commitlint](https://img.shields.io/badge/Commitlint-Configured-orange)
![Husky](https://img.shields.io/badge/Husky-Configured-red)
![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-Configured-success)
![Vitest](https://img.shields.io/badge/Vitest-Configured-blue)
![Playwright](https://img.shields.io/badge/Playwright-Configured-green)

Kickstart your modern Next.js projects with this template featuring TypeScript,
Tailwind CSS for styling, and testing utilities such as Vitest and Playwright.
It comes pre-configured with ESLint, Prettier, Commitlint, Husky, and GitHub
Actions for a solid development setup.

> **Warning**  
> This app is a work in progress.

## Features

- **TypeScript** 📜: Full TypeScript support for type safety.
- **Tailwind CSS** 🌀: Utility-first CSS framework for styling.
- **Testing** 🧪: Vitest for unit testing and Playwright for end-to-end testing.
- **ESLint** 🧹: Integrated for code linting and ensuring best practices.
- **Prettier** 🎨: Code formatting for consistent style.
- **Commitlint** 📝: Enforce conventional commit messages.
- **Husky** 🐶: Git hooks for pre-commit and commit-msg linting.
- **Zod** 🛠️: Schema validation for data integrity.
- **clsx** 🎯: Conditional class name utility for React components.
- **Tailwind Merge** 🧳: Tailwind class merging for cleaner code.
- **next-intl** 🌍: Internationalization support for multiple languages.
- **React Query** 🔄: Efficient data-fetching and caching with React Query.
- **Axios** 📡: Promise-based HTTP client for making requests.
- **Lucide React** ✨: Beautifully designed icons for React.
- **React Hook Form** 📑: Form handling with validation and easy integration.
- **Sonner** 🌞: Toast notifications with animations.

## Setup

1. Clone the repository:

   ```sh
   git clone https://github.com/diwashbhattarai999/nextjs-frontend-template
   cd nextjs-frontend-template
   ```

2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Copy `.env.example` to `.env.local` and update your environment variables:

   ```sh
   cp .env.example .env.local
   ```

4. Start the development server:

   ```sh
   pnpm dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Folder Structure

```
.
├── .github                         # GitHub Actions workflows
├── .husky                          # Husky Git hooks
├── .vscode                         # VS Code settings and extensions
├── public                          # Static files (images, fonts, etc.)
├── src
│   ├── app                         # All Next.js pages and API routes
│       ├── [locale]                # Internationalized pages and routes
│           ├── (auth)              # Authentication pages and routes
│           ├── (not-found)         # For catching all remaining routes for 404
│           ├── (unauth)            # Unauthenticated pages and routes
│           ├── layout.tsx          # Layout component for the locale
│           ├── not-found.tsx       # 404 page for internationalized routes
│           ├── page.tsx            # Home page
│       ├── favicon.ico             # Favicon for the app
│       ├── global-error.tsx        # Global error boundary component
│       ├── layout.tsx              # Root layout component
│       ├── manifest.ts             # Web app manifest
│       ├── not-found.tsx           # 404 page for non-internationalized routes
│       ├── robots.ts               # Robots.txt file
│       ├── sitemap.ts              # Sitemap.xml file
│   ├── components                  # Reusable UI components
│   ├── configs                     # Configuration files
│   ├── constants                   # Constants and enums
│   ├── hooks                       # Custom React hooks
│   ├── i18n                        # Internationalization utilities
│   ├── lib                         # Utility functions and classes
│   ├── styles                      # Tailwind CSS and global styles
│   ├── tests                       # Unit and integration tests
│   ├── types                       # TypeScript types and interfaces
│   ├── utils                       # Utility functions
│   ├── middleware.ts               # Middleware for Next.js API routes
│   └── ...
├── .env.example                    # Environment variables example
├── .gitignore                      # Git ignore rules
├── .prettierrc                     # Prettier configuration
├── .commitlintrc.config.ts         # Commitlint configuration
├── .eslintrc.config.mjs            # ESLint configuration
├── LICENSE                         # License information
├── next.config.ts                  # Next.js configuration
├── package.json                    # NPM package configuration
├── playwright.config.ts            # Playwright configuration
├── pnpm-lock.yaml                  # pnpm lockfile
├── postcss.config.mjs              # PostCSS configuration
├── README.md                       # Project README
├── tailwind.config.ts              # Tailwind CSS configuration
├── tsconfig.json                   # TypeScript configuration
├── vitest.config.ts                # Vitest configuration
└── ...
```

## Contributing

Contributions are welcome! Please fork this repository and submit a pull request
with a description of your changes. Ensure that you follow the commit message
guidelines and write tests for any new features.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.

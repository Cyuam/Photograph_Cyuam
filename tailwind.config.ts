import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
  		extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  			keyframes: {
				'float-slow': {
					'0%, 100%': { transform: 'translate3d(0, 0, 0)' },
					'50%': { transform: 'translate3d(0, -12px, 0)' }
				},
				'float-slower': {
					'0%, 100%': { transform: 'translate3d(0, 0, 0)' },
					'50%': { transform: 'translate3d(0, 14px, 0)' }
				},
				'hand-left': {
					'0%, 100%': { transform: 'translate3d(0, 0, 0) rotate(-6deg)' },
					'50%': { transform: 'translate3d(12px, -8px, 0) rotate(-2deg)' }
				},
				'hand-right': {
					'0%, 100%': { transform: 'translate3d(0, 0, 0) rotate(6deg)' },
					'50%': { transform: 'translate3d(-12px, -10px, 0) rotate(2deg)' }
				},
				'orb-pulse': {
					'0%, 100%': { opacity: '0.65', transform: 'scale(0.95)' },
					'50%': { opacity: '1', transform: 'scale(1.05)' }
				},
				'line-sweep': {
					'0%': { transform: 'translateX(-12%)' },
					'100%': { transform: 'translateX(12%)' }
				},
				'spin-slower': {
					from: { transform: 'rotate(0deg)' },
					to: { transform: 'rotate(360deg)' }
				},
				'fade-rise': {
					'0%': { opacity: '0', transform: 'translate3d(0, 16px, 0)' },
					'100%': { opacity: '1', transform: 'translate3d(0, 0, 0)' }
				},
  				'accordion-down': {
  					from: {
  						height: '0'
  					},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  			animation: {
				'float-slow': 'float-slow 7s ease-in-out infinite',
				'float-slower': 'float-slower 10s ease-in-out infinite',
				'hand-left': 'hand-left 9s ease-in-out infinite',
				'hand-right': 'hand-right 9s ease-in-out infinite',
				'orb-pulse': 'orb-pulse 6s ease-in-out infinite',
				'line-sweep': 'line-sweep 5s ease-in-out infinite alternate',
				'spin-slower': 'spin-slower 40s linear infinite',
				'fade-rise': 'fade-rise 1s ease-out forwards',
  				'accordion-down': 'accordion-down 0.2s ease-out',
  				'accordion-up': 'accordion-up 0.2s ease-out'
  			}
  		}
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  prefix: '',
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	// Add extra breakpoints for more granular responsive control
  	screens: {
  		'xs': '400px',     // Very small phones
  		'sm': '640px',     // Default Tailwind
  		'md': '768px',     // Default Tailwind  
  		'lg': '1024px',    // Default Tailwind
  		'xl': '1280px',    // Default Tailwind
  		'2xl': '1536px',   // Default Tailwind
  		// Custom breakpoints for compact screens
  		'compact': { 'max': '480px' },     // Compact mobile
  		'tablet': { 'min': '641px', 'max': '1023px' }, // Tablets only
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			pending: {
  				from: '#3B82F6',
  				to: '#60A5FA',
  				light: '#DBEAFE',
  				dark: '#1E40AF'
  			},
  			undecided: {
  				from: '#F59E0B',
  				to: '#FBBF24',
  				light: '#FEF3C7',
  				dark: '#B45309'
  			},
  			completed: {
  				from: '#10B981',
  				to: '#34D399',
  				light: '#D1FAE5',
  				dark: '#065F46'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		// Responsive font sizes with clamp for fluid typography
  		fontSize: {
  			'fluid-xs': ['clamp(0.65rem, 2vw, 0.75rem)', { lineHeight: '1rem' }],
  			'fluid-sm': ['clamp(0.75rem, 2.5vw, 0.875rem)', { lineHeight: '1.25rem' }],
  			'fluid-base': ['clamp(0.875rem, 3vw, 1rem)', { lineHeight: '1.5rem' }],
  			'fluid-lg': ['clamp(1rem, 3.5vw, 1.125rem)', { lineHeight: '1.75rem' }],
  			'fluid-xl': ['clamp(1.125rem, 4vw, 1.25rem)', { lineHeight: '1.75rem' }],
  			'fluid-2xl': ['clamp(1.25rem, 5vw, 1.5rem)', { lineHeight: '2rem' }],
  		},
  		// Add spacing scale adjustments
  		spacing: {
  			'safe': 'max(1rem, env(safe-area-inset-left))',
  		},
  		boxShadow: {
  			'elev-1': '0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
  			'elev-2': '0 4px 8px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
  			'elev-3': '0 8px 16px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08)',
  			premium: '0 8px 30px rgba(0, 0, 0, 0.12)',
  			'glow-blue': '0 0 20px rgba(59, 130, 246, 0.3)',
  			'glow-amber': '0 0 20px rgba(245, 158, 11, 0.3)',
  			'glow-green': '0 0 20px rgba(16, 185, 129, 0.3)'
  		},
  		keyframes: {
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
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '0% 50%'
  				},
  				'50%': {
  					backgroundPosition: '100% 50%'
  				},
  				'100%': {
  					backgroundPosition: '0% 50%'
  				}
  			},
  			'gradient-x': {
  				'0%, 100%': {
  					backgroundPosition: '0% 50%'
  				},
  				'50%': {
  					backgroundPosition: '100% 50%'
  				}
  			},
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0px)'
  				},
  				'50%': {
  					transform: 'translateY(-10px)'
  				}
  			},
  			'badge-pulse': {
  				'0%, 100%': {
  					opacity: '1'
  				},
  				'50%': {
  					opacity: '0.6'
  				}
  			},
  			'check-pop': {
  				'0%': {
  					transform: 'scale(0.8)'
  				},
  				'50%': {
  					transform: 'scale(1.1)'
  				},
  				'100%': {
  					transform: 'scale(1)'
  				}
  			},
  			ripple: {
  				'0%': {
  					transform: 'scale(0)',
  					opacity: '0.5'
  				},
  				'100%': {
  					transform: 'scale(4)',
  					opacity: '0'
  				}
  			},
  			'bounce-in': {
  				'0%': {
  					transform: 'scale(0.9)',
  					opacity: '0'
  				},
  				'50%': {
  					transform: 'scale(1.02)'
  				},
  				'100%': {
  					transform: 'scale(1)',
  					opacity: '1'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			shimmer: 'shimmer 2.5s linear infinite',
  			'gradient-x': 'gradient-x 3s ease infinite',
  			float: 'float 3s ease-in-out infinite',
  			'badge-pulse': 'badge-pulse 2s ease-in-out infinite',
  			'check-pop': 'check-pop 0.3s ease-out',
  			ripple: 'ripple 0.6s ease-out',
  			'bounce-in': 'bounce-in 0.5s ease-out'
  		}
  	}
  },
  plugins: [require('tailwindcss-animate'), require('@tailwindcss/typography')],
}

export default config

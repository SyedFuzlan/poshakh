'use client'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    capture_pageview: false, // Disable automatic pageview capture, as we use manual capture for Next.js
    persistence: 'localStorage',
  })
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Capture UTM parameters
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const utmParams: Record<string, string> = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
        const value = urlParams.get(param);
        if (value) {
          utmParams[param] = value;
          sessionStorage.setItem(param, value);
        }
      });
      
      if (Object.keys(utmParams).length > 0) {
        posthog.register(utmParams); // Ensure all future events in this session have these tags
      }
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

// Utility to track events from anywhere
export const trackEvent = (event: string, properties?: Record<string, unknown>) => {
  if (typeof window !== 'undefined') {
    posthog.capture(event, properties)
  }
}

// Utility to identify user (e.g. after login)
export const identifyUser = (id: string, traits?: Record<string, unknown>) => {
  if (typeof window !== 'undefined') {
    posthog.identify(id, traits)
  }
}

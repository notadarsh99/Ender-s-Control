"use client"

import Snowfall from 'react-snowfall'
import uiConfig from '../config/sections/ui.json'

export default function ChristmasSnowfall() {
  if (!uiConfig.christmasTheme.enabled) {
    return null
  }

  return (
    <Snowfall
      color="#fff"
      snowflakeCount={30}
      style={{
        position: 'fixed',
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    />
  )
}
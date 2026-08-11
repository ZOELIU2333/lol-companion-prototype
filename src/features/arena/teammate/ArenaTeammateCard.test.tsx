// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ArenaTeammateCard } from './ArenaTeammateCard'

afterEach(cleanup)

describe('ArenaTeammateCard', () => {
  it('renders a compact real-evidence horse tier', () => {
    render(<ArenaTeammateCard state={{
      status: 'rated',
      teammateName: '真实队友',
      championId: 103,
      rating: {
        label: '上等马', score: 78, confidence: 'high', sampleSize: 8,
        reasons: ['竞技场近期状态强'], source: 'opgg',
      },
    }} />)

    expect(screen.getByText('上等马')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.getByText('真实队友')).toBeInTheDocument()
    expect(screen.queryByText(/Demo/)).not.toBeInTheDocument()
  })

  it('shows loading without inventing a score', () => {
    render(<ArenaTeammateCard state={{ status: 'loading', teammateName: '队友' }} />)

    expect(screen.getByText('正在读取公开战绩')).toBeInTheDocument()
    expect(screen.queryByText(/上等马|中等马|下等马/)).not.toBeInTheDocument()
  })

  it('explains insufficient evidence', () => {
    render(<ArenaTeammateCard state={{
      status: 'insufficient', teammateName: '队友', reason: '仅有 2 场可用战绩，不足以评级',
      rating: { label: '情报不足', score: null, confidence: 'low', sampleSize: 2, reasons: [], source: 'riot' },
    }} />)

    expect(screen.getByText('情报不足')).toBeInTheDocument()
    expect(screen.getByText(/仅有 2 场/)).toBeInTheDocument()
  })
})

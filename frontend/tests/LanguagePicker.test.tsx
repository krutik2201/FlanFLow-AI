import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { LanguagePicker } from '../src/components/LanguagePicker'
import { AIProvider } from '../src/context/AIContext'

describe('LanguagePicker Component', () => {
  test('renders language picker with default select element', () => {
    render(
      <AIProvider>
        <LanguagePicker />
      </AIProvider>
    )

    const select = screen.getByLabelText(/select language/i)
    expect(select).toBeInTheDocument()
    expect(select).toHaveValue('en')
  })

  test('allows changing language option', async () => {
    render(
      <AIProvider>
        <LanguagePicker />
      </AIProvider>
    )

    const select = screen.getByLabelText(/select language/i)
    await userEvent.selectOptions(select, 'es')
    expect(select).toHaveValue('es')
  })
})

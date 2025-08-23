import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResourceForkParser from '../components/ResourceForkParserRedesigned';

// Mock the rsrcdump library
vi.mock('../lib/rsrcdump/rsrcdump', () => ({
  saveToJson: vi.fn(() => ({
    Hedr: { 1000: 'test data' },
    Layr: { 1000: 'layer data' }
  })),
  saveFromJson: vi.fn(() => new Uint8Array([1, 2, 3, 4])),
}));

// Mock fetch for EarthFarm sample
global.fetch = vi.fn();

describe('ResourceForkParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
    });
  });

  it('renders the main interface components', () => {
    render(<ResourceForkParser />);
    
    expect(screen.getByText('Mac Resource Fork Parser')).toBeInTheDocument();
    expect(screen.getByText('Upload a resource fork file to analyze and experiment with data types')).toBeInTheDocument();
    expect(screen.getByText('Save & Load Specifications')).toBeInTheDocument();
    expect(screen.getByText('File Operations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose \.rsrc File/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Convert from JSON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load EarthFarm Sample/i })).toBeInTheDocument();
  });

  it('has dark theme styling', () => {
    render(<ResourceForkParser />);
    
    const mainContainer = document.querySelector('.bg-gray-900');
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer).toHaveClass('text-gray-100');
  });

  it('has save/load specifications in a collapsible section', () => {
    render(<ResourceForkParser />);
    
    const saveLoadSection = screen.getByText('Save & Load Specifications');
    expect(saveLoadSection).toBeInTheDocument();
    
    // Should be inside a collapsible card
    const cardContainer = saveLoadSection.closest('[data-state]') || saveLoadSection.closest('.cursor-pointer');
    expect(cardContainer).toBeInTheDocument();
  });

  it('loads EarthFarm sample and displays four-letter codes', async () => {
    render(<ResourceForkParser />);
    
    const loadButton = screen.getByRole('button', { name: /Load EarthFarm Sample/i });
    fireEvent.click(loadButton);
    
    await waitFor(() => {
      expect(screen.getByText('Four-Letter Code Specifications')).toBeInTheDocument();
    });
    
    // Should show Hedr and Layr specifications
    await waitFor(() => {
      expect(screen.getByText('Hedr')).toBeInTheDocument();
      expect(screen.getByText('Layr')).toBeInTheDocument();
    });
  });

  it('shows download JSON button when file is loaded', async () => {
    render(<ResourceForkParser />);
    
    const loadButton = screen.getByRole('button', { name: /Load EarthFarm Sample/i });
    fireEvent.click(loadButton);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Download as JSON/i })).toBeInTheDocument();
    });
  });

  it('has wider type dropdowns', async () => {
    render(<ResourceForkParser />);
    
    const loadButton = screen.getByRole('button', { name: /Load EarthFarm Sample/i });
    fireEvent.click(loadButton);
    
    await waitFor(() => {
      const dropdowns = screen.getAllByRole('combobox');
      expect(dropdowns.length).toBeGreaterThan(0);
      
      // Check that dropdowns have sufficient width class
      dropdowns.forEach(dropdown => {
        expect(dropdown).toHaveClass('w-64');
      });
    });
  });

  it('displays sample data for each four-letter code', async () => {
    render(<ResourceForkParser />);
    
    const loadButton = screen.getByRole('button', { name: /Load EarthFarm Sample/i });
    fireEvent.click(loadButton);
    
    await waitFor(() => {
      expect(screen.getAllByText('Sample Data:')).toHaveLength(2);
    });
  });

  it('has single column layout (not cramped)', () => {
    render(<ResourceForkParser />);
    
    const mainContainer = document.querySelector('.max-w-5xl');
    expect(mainContainer).toBeInTheDocument();
    expect(mainContainer).toHaveClass('space-y-8');
  });

  it('combines upload/download in single file operations box', () => {
    render(<ResourceForkParser />);
    
    const fileOpsSection = screen.getByText('File Operations').closest('div');
    expect(fileOpsSection).toBeInTheDocument();
    
    // Should contain all upload options and download in one section
    expect(screen.getByRole('button', { name: /Choose \.rsrc File/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Convert from JSON/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load EarthFarm Sample/i })).toBeInTheDocument();
  });

  it('does not show generated spec text', async () => {
    render(<ResourceForkParser />);
    
    const loadButton = screen.getByRole('button', { name: /Load EarthFarm Sample/i });
    fireEvent.click(loadButton);
    
    await waitFor(() => {
      expect(screen.getByText('Hedr')).toBeInTheDocument();
    });
    
    // Should not show generated spec like "Hedr:L5i3f5i40xi+"
    expect(screen.queryByText(/Hedr:L5i3f5i40xi\+/)).not.toBeInTheDocument();
  });

  it('shows status indicators for validation', async () => {
    render(<ResourceForkParser />);
    
    const loadButton = screen.getByRole('button', { name: /Load EarthFarm Sample/i });
    fireEvent.click(loadButton);
    
    await waitFor(() => {
      // Should show success status
      expect(screen.getAllByText('Successfully parsed data')).toHaveLength(2);
    });
  });
});
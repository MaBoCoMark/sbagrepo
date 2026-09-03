import React from 'react';
import { Box, Heading, Text, Label, IconButton } from '@primer/react';
import { SunIcon, MoonIcon, TerminalIcon, CpuIcon } from '@primer/octicons-react';
import { ProcessStatus, DefaultPaths } from '../types';

interface HeaderProps {
  colorMode: 'day' | 'night';
  onToggleTheme: () => void;
  status: ProcessStatus;
  paths: DefaultPaths | null;
}

export const Header: React.FC<HeaderProps> = ({
  colorMode,
  onToggleTheme,
  status,
  paths,
}) => {
  const getStatusLabel = () => {
    switch (status) {
      case 'running':
        return <Label variant="success">Running (Direct)</Label>;
      case 'elevated':
        return <Label variant="attention">Running (Admin / TUN)</Label>;
      case 'checking':
        return <Label variant="accent">Checking Config...</Label>;
      case 'stopped':
      default:
        return <Label variant="secondary">Stopped</Label>;
    }
  };

  const getPlatformLabel = () => {
    if (!paths) return null;
    if (paths.os === 'macos') {
      return (
        <Label variant="accent" sx={{ ml: 2 }}>
          macOS Apple Silicon (aarch64)
        </Label>
      );
    }
    if (paths.os === 'windows') {
      return (
        <Label variant="accent" sx={{ ml: 2 }}>
          Windows x64 (msvc)
        </Label>
      );
    }
    return (
      <Label variant="secondary" sx={{ ml: 2 }}>
        {paths.os} ({paths.arch})
      </Label>
    );
  };

  return (
    <Box
      as="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 4,
        py: 3,
        borderBottom: '1px solid',
        borderColor: 'border.default',
        bg: 'canvas.subtle',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 2,
            bg: 'accent.emphasis',
            color: 'fg.onEmphasis',
          }}
        >
          <TerminalIcon size={20} />
        </Box>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Heading as="h1" sx={{ fontSize: 2, fontWeight: 'bold', m: 0 }}>
              sing-box Control Center
            </Heading>
            <Label size="small" variant="secondary">
              v1.0 MVP
            </Label>
            {getPlatformLabel()}
          </Box>
          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
            Desktop Management for Apple Silicon & Windows x64
          </Text>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Text sx={{ fontSize: 1, color: 'fg.muted' }}>Status:</Text>
          {getStatusLabel()}
        </Box>

        <IconButton
          aria-label={colorMode === 'day' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          icon={colorMode === 'day' ? MoonIcon : SunIcon}
          size="medium"
          onClick={onToggleTheme}
        />
      </Box>
    </Box>
  );
};

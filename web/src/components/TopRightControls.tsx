import Stack from '@mui/material/Stack';
import ColorModeSelect from '../shared-theme/ColorModeSelect';

interface TopRightControlsProps {
  floating?: boolean;
}

export default function TopRightControls({ floating = false }: TopRightControlsProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{
        flexShrink: 0,
        alignItems: 'flex-end',
        ...(floating
          ? {
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: (theme) => theme.zIndex.appBar,
          }
          : null),
      }}
    >
      <ColorModeSelect
        size="small"
        sx={{
          minWidth: 112,
          height: 40,
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            minHeight: '40px',
            py: 0,
          },
        }}
      />
    </Stack>
  );
}

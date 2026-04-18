import { alpha } from '@mui/material/styles';
import type { Theme, Components } from '@mui/material/styles';
import { inputBaseClasses } from '@mui/material/InputBase';
import { inputLabelClasses } from '@mui/material/InputLabel';
import { formHelperTextClasses } from '@mui/material/FormHelperText';
import { iconButtonClasses } from '@mui/material/IconButton';
import { brand } from '../themePrimitives';

/* eslint-disable import/prefer-default-export */
export const formInputCustomizations: Components<Theme> = {
  MuiInputLabel: {
    styleOverrides: {
      root: {
        [`&.${inputLabelClasses.outlined}`]: {
          transform: 'translate(14px, 18px) scale(1)',
        },
        [`&.${inputLabelClasses.shrink}`]: {
          transform: 'translate(14px, -9px) scale(0.75)',
        },
      },
      sizeSmall: {
        [`&.${inputLabelClasses.outlined}`]: {
          transform: 'translate(14px, 14px) scale(1)',
        },
        [`&.${inputLabelClasses.shrink}`]: {
          transform: 'translate(14px, -9px) scale(0.75)',
        },
      },
    },
  },
  MuiFormControl: {
    styleOverrides: {
      root: ({ theme }) => ({
        [`& .${inputBaseClasses.root}`]: {
          marginTop: 10,
        },
        [`& .${formHelperTextClasses.root}`]: {
          marginLeft: 2,
        },
        '& .MuiPickersInputBase-root': {
          marginTop: 6,
          border: `1px solid ${(theme.vars || theme).palette.divider}`,
          ' .MuiPickersInputBase-sectionsContainer': {
            padding: '10px 0',
          },
          ' .MuiPickersOutlinedInput-notchedOutline': {
            border: 'none',
          },
          [`&.MuiPickersOutlinedInput-root.Mui-focused`]: {
            border: `1px solid ${(theme.vars || theme).palette.divider}`,
            outline: `3px solid ${alpha(brand[500], 0.5)}`,
            borderColor: brand[400],
            ' .MuiPickersOutlinedInput-notchedOutline': {
              border: 'none',
            },
          },
          [` .${iconButtonClasses.root}`]: {
            border: 'none',
            height: '34px',
            width: '34px',
          },
        },
      }),
    },
  },
};

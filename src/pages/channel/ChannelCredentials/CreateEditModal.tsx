import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  channelApi,
  type ChannelCredentialDTO,
  type ChannelCredentialSecretDTO,
} from '@/api/channel';
import { ApiError, ResponseCode } from '@/api/types';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/LoadingButton';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { notifySuccess } from '@/lib/toast';

export interface CreateEditModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialData: ChannelCredentialDTO | null;
  onClose: () => void;
  onSuccess: (secretData?: ChannelCredentialSecretDTO) => void;
}

const createEditSchema = z.object({
  channelName: z
    .string()
    .min(1, '请输入渠道名称')
    .max(128, '渠道名称长度不可超过 128 字符')
    .refine((val) => val.trim().length > 0, '渠道名称不可为空白字符'),
});

type CreateEditFormValues = z.infer<typeof createEditSchema>;

export const CreateEditModal: React.FC<CreateEditModalProps> = ({
  open,
  mode,
  initialData,
  onClose,
  onSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);

  const openKey = open ? (initialData ? `${mode}:${initialData.id}` : 'create') : null;

  const { control, handleSubmit, reset, setError } = useForm<CreateEditFormValues>({
    resolver: zodResolver(createEditSchema),
    defaultValues: {
      channelName: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initialData) {
        reset({ channelName: initialData.channelName });
      } else {
        reset({ channelName: '' });
      }
    }
  }, [open, mode, initialData, reset]);

  const onValid = async (values: CreateEditFormValues) => {
    const channelName = values.channelName.trim();
    try {
      setSubmitting(true);
      if (mode === 'create') {
        const secretDto = await channelApi.create({ channelName });
        notifySuccess('创建渠道凭证成功');
        onSuccess(secretDto);
      } else if (mode === 'edit' && initialData) {
        await channelApi.update(initialData.id, { channelName });
        notifySuccess('修改渠道凭证成功');
        onSuccess();
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === ResponseCode.INVALID_ARGUMENT) {
        setError('channelName', {
          type: 'server',
          message: err.info || '渠道名称不合法',
        });
        return;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onInvalid = () => {};

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新建渠道凭证' : '编辑渠道凭证'}</DialogTitle>
        </DialogHeader>

        <form key={openKey ?? 'closed'} onSubmit={handleSubmit(onValid, onInvalid)}>
          <FieldGroup>
            {mode === 'edit' && initialData && (
              <Field>
                <FieldLabel htmlFor="channelCode">渠道编码</FieldLabel>
                <Input id="channelCode" value={initialData.channelCode} disabled />
              </Field>
            )}

            <Controller
              name="channelName"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="channelName">渠道名称</FieldLabel>
                  <Input
                    {...field}
                    id="channelName"
                    aria-invalid={fieldState.invalid}
                    placeholder="请输入渠道名称（≤128 字符）"
                    maxLength={128}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>

          <DialogFooter className="mt-6">
            <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <LoadingButton loading={submitting} type="submit">
              确定
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

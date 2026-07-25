<template>
  <ConfirmDialog
    :visible="dialogState.visible.value"
    :title="dialogState.title.value"
    :message="dialogState.message.value"
    :icon="dialogState.icon.value"
    :confirm-text="dialogState.confirmText.value"
    :cancel-text="dialogState.cancelText.value"
    :variant="dialogState.variant.value"
    @confirm="onConfirm"
    @cancel="onCancel"
  />
</template>

<script setup>
import ConfirmDialog from './ConfirmDialog.vue'
import { useConfirm } from '../composables/useConfirm'

const { dialogState, onConfirm, onCancel } = useConfirm()
</script>

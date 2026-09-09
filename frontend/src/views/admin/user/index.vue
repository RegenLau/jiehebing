<template>
  <div class="admin-user-page">
    <div class="toolbar">
      <div>
        <h2>管理员管理</h2>
        <p>当前后台只保留管理员维护，支持新增和编辑。</p>
      </div>
      <div class="actions">
        <ElButton @click="loadList" :loading="loading">刷新</ElButton>
        <ElButton type="primary" @click="openCreate">新增管理员</ElButton>
      </div>
    </div>

    <ElCard shadow="never">
      <ElTable :data="list" v-loading="loading" border>
        <ElTableColumn prop="id" label="ID" width="80" />
        <ElTableColumn prop="username" label="用户名" min-width="180" />
        <ElTableColumn prop="realname" label="姓名" /><ElTableColumn
          prop="hospital_name"
          label="医院"
        /><ElTableColumn prop="department_name" label="科室" /><ElTableColumn
          prop="phone"
          label="手机号"
          min-width="140"
        />
        <ElTableColumn prop="email" label="邮箱" min-width="220" />
        <ElTableColumn label="状态" width="100">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="created_at" label="创建时间" min-width="180" />
        <ElTableColumn prop="updated_at" label="更新时间" min-width="180" />
        <ElTableColumn label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <ElButton link type="primary" @click="openEdit(row)">编辑</ElButton>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>

    <ElDialog v-model="dialogVisible" :title="isEdit ? '编辑管理员' : '新增管理员'" width="520px">
      <ElForm ref="formRef" :model="formData" :rules="rules" label-width="90px">
        <ElFormItem label="姓名"><ElInput v-model.trim="formData.realname" /></ElFormItem
        ><ElFormItem label="医院"><ElInput v-model.trim="formData.hospital_name" /></ElFormItem
        ><ElFormItem label="科室"><ElInput v-model.trim="formData.department_name" /></ElFormItem
        ><ElFormItem label="用户名" prop="username">
          <ElInput v-model.trim="formData.username" placeholder="请输入用户名" />
        </ElFormItem>
        <ElFormItem :label="isEdit ? '新密码' : '密码'" prop="password">
          <ElInput
            v-model.trim="formData.password"
            type="password"
            show-password
            :placeholder="isEdit ? '不修改可留空' : '请输入密码'"
          />
        </ElFormItem>
        <ElFormItem label="手机号">
          <ElInput v-model.trim="formData.phone" placeholder="请输入手机号" />
        </ElFormItem>
        <ElFormItem label="邮箱">
          <ElInput v-model.trim="formData.email" placeholder="请输入邮箱" />
        </ElFormItem>
        <ElFormItem label="状态">
          <ElSwitch v-model="formData.status" :active-value="1" :inactive-value="0" />
        </ElFormItem>
      </ElForm>

      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitForm">保存</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import type { FormInstance, FormRules } from 'element-plus'
  import { createAdmin, fetchAdminList, updateAdmin, type AdminRecord } from '@/api/admin'

  defineOptions({ name: 'AdminUser' })

  const loading = ref(false)
  const submitting = ref(false)
  const dialogVisible = ref(false)
  const isEdit = ref(false)
  const formRef = ref<FormInstance>()
  const list = ref<AdminRecord[]>([])

  const formData = reactive({
    id: undefined as number | undefined,
    realname: '',
    hospital_name: '',
    department_name: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    status: 1
  })

  const rules = computed<FormRules>(() => ({
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [
      {
        validator: (_rule, value, callback) => {
          if (!isEdit.value && !value) {
            callback(new Error('请输入密码'))
            return
          }
          callback()
        },
        trigger: 'blur'
      }
    ]
  }))

  const resetForm = () => {
    formData.id = undefined
    formData.realname = ''
    formData.hospital_name = ''
    formData.department_name = ''
    formData.username = ''
    formData.password = ''
    formData.phone = ''
    formData.email = ''
    formData.status = 1
  }

  const loadList = async () => {
    loading.value = true
    try {
      list.value = await fetchAdminList()
    } finally {
      loading.value = false
    }
  }

  const openCreate = () => {
    isEdit.value = false
    resetForm()
    dialogVisible.value = true
  }

  const openEdit = (row: any) => {
    const record = row as AdminRecord
    isEdit.value = true
    formData.id = record.id
    formData.realname = record.realname || ''
    formData.hospital_name = record.hospital_name || ''
    formData.department_name = record.department_name || ''
    formData.username = record.username
    formData.password = ''
    formData.phone = record.phone
    formData.email = record.email
    formData.status = record.status
    dialogVisible.value = true
  }

  const submitForm = async () => {
    if (!formRef.value) return
    await formRef.value.validate()

    submitting.value = true
    try {
      if (isEdit.value) {
        await updateAdmin({ ...formData })
      } else {
        await createAdmin({ ...formData })
      }
      dialogVisible.value = false
      await loadList()
    } finally {
      submitting.value = false
    }
  }

  onMounted(() => {
    loadList()
  })
</script>

<style scoped lang="scss">
  .admin-user-page {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;

    h2 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 700;
    }

    p {
      margin: 0;
      color: #6b7280;
      font-size: 14px;
    }
  }

  .actions {
    display: flex;
    gap: 12px;
  }
</style>

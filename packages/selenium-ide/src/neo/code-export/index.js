// Licensed to the Software Freedom Conservancy (SFC) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The SFC licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import UiState from '../stores/view/UiState'
import ModalState from '../stores/view/ModalState'
import exporter from 'code-export'
import { downloadUniqueFile, createBlob } from '../IO/filesystem'
import { normalizeTestsInSuite } from '../IO/normalize'
import PluginManager from '../../plugin/manager'
import { availableLanguages as languages } from 'code-export'
// const fs = require('fs')
const vendorLanguages = PluginManager.plugins.vendorLanguages

export function availableLanguages() {
  return Object.keys(vendorLanguages).length
    ? { ...languages, ...vendorLanguages }
    : languages
}

export async function exportCodeToFile(
  selectedLanguages,
  { test, suite },
  { enableOriginTracing }
) {
  const project = UiState.project.toJS()
  const { url, tests } = project
  for (const language of selectedLanguages) {
    let emittedCode
    let options = {
      url,
      tests,
      project,
      enableOriginTracing,
    }
    options.test = test ? test : undefined
    options.suite = suite ? normalizeTestsInSuite({ suite, tests }) : undefined
    if (vendorLanguages.hasOwnProperty(language)) {
      const result = await PluginManager.emitMessage({
        action: 'export',
        entity: 'vendor',
        language,
        options,
      })
      emittedCode = result[0].response
    } else if (test) {
      emittedCode = await exporter.emit.test(language, options)
    } else if (suite) {
      emittedCode = await exporter.emit.suite(language, options)
    }
    if (emittedCode) {
      downloadUniqueFile(emittedCode.filename, emittedCode.body)
    }
  }
  ModalState.cancelCodeExport()
}

function getCookies(url, callback) {
  chrome.cookies.getAll({ url }, function(cookies) {
    debugger
    if (callback) {
      callback(cookies)
    }
  })
}

export async function exportCodeToServer(
  selectedLanguages,
  { test, suite },
  { enableOriginTracing }
) {
  const project = UiState.project.toJS()
  const { url, tests } = project
  for (const language of selectedLanguages) {
    let emittedCode
    let options = {
      url,
      tests,
      project,
      enableOriginTracing,
    }
    options.test = test ? test : undefined
    options.suite = suite ? normalizeTestsInSuite({ suite, tests }) : undefined
    if (vendorLanguages.hasOwnProperty(language)) {
      const result = await PluginManager.emitMessage({
        action: 'export',
        entity: 'vendor',
        language,
        options,
      })
      emittedCode = result[0].response
    } else if (test) {
      emittedCode = await exporter.emit.test(language, options)
    } else if (suite) {
      emittedCode = await exporter.emit.suite(language, options)
    }

    const hostLocation = chrome.runtime.getURL('host.json')
    fetch(hostLocation)
      .then(response => response.json()) //assuming file contains json
      .then(json => {
        let cookie_host = json.COOKIE_HOST
        let record_host = json.RECORD_HOST
        getCookies(cookie_host, function(cookies) {
          const formData = new FormData()
          const headers = {}

          if (Array.isArray(cookies)) {
            cookies.forEach(cookie => {
              if (cookie.name == 'jobCode') {
                formData.append(cookie.name, cookie.value)
              }

              if (cookie.name === 'token') {
                headers['Authorization'] = cookie.value
              }
              if (cookie.name === 'spaceId') {
                headers['spaceId'] = cookie.value
              }
            })
          }
          // transfered code emittedCode.body
          const seleniumFile = new Blob([emittedCode.body], {
            type: 'text/plain',
          })
          formData.append('seleniumFile', seleniumFile)

          // QA
          fetch(record_host, {
            // 开发环境
            // fetch('http://10.152.84.17:8409/rpa/job/selenium/addprogram', {
            method: 'POST',
            headers,
            body: formData,
          })
            .then(jobName => {
              UiState.displayedTest.clearAllCommands()
              ModalState.showAlert({
                title: '消息',
                description: `录制结果成功发送`,
                confirmLabel: 'close',
              })
            })
            .catch(() => {
              ModalState.showAlert({
                title: '网络错误',
                description: `发送录制结果失败`,
                confirmLabel: 'close',
              })
            })
        })
      })
    console.log(emittedCode.body)
  }
}

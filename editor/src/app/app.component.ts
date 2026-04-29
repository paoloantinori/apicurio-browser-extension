/**
 * @license
 * Copyright 2022 Red Hat
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Component, ViewChild} from "@angular/core";
import {LoggerService} from "./services/logger.service";
import {ConfigService} from "./services/config.service";
import {EditingInfo} from "./models/editingInfo.model";
import {EditorComponent} from "./components/editors/editor.component";
import {ApiDefinition} from "./editor/_models/api.model";

interface PendingRequest {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timer: any;
}

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.css"]
})
export class AppComponent {
    title = "studio-editor";
    api: ApiDefinition;

    isShowLoading: boolean = true;
    isShowEditor: boolean = false;
    isShowError: boolean = false;

    config: EditingInfo;

    private pendingFetches: Map<string, PendingRequest> = new Map();

    @ViewChild("openapiEditor") openapiEditor: EditorComponent | undefined;
    @ViewChild("asyncapiEditor") asyncapiEditor: EditorComponent | undefined;

    constructor(private logger: LoggerService, private configService: ConfigService) {
        this.listenForFetchResponses();
        configService.get().then(cfg => {
            this.config = cfg;
            this.initContent();
        }).catch(error => {
            this.logger.error("Failed to get editor configuration: %o", error);
        });
    }

    private initContent(): void {
        try {
            const content: any = JSON.parse(this.config.content.value);
            this.logger.info("[AppComponent] JSON content successfully parsed.");

            this.api = new ApiDefinition();
            this.api.createdBy = "user";
            this.api.createdOn = new Date();
            this.api.tags = [];
            this.api.description = "";
            this.api.id = "api-1";
            this.api.spec = content;
            this.api.type = "OpenAPI30";
            if (content && content.swagger && content.swagger === "2.0") {
                this.api.type = "OpenAPI20";
            }

            this.isShowLoading = false;
            this.isShowEditor = true;
        } catch (error) {
            this.logger.error("Error loading HTTP content: %o", error);
        }
    }

    private editor(): EditorComponent {
        return this.config.content.type === "OPENAPI" ? this.openapiEditor : this.asyncapiEditor;
    }

    /**
     * Content fetcher that resolves external $ref references by requesting
     * the parent frame to fetch the content via postMessage.
     */
    contentFetcher = (externalReference: string): Promise<any> => {
        return new Promise<any>((resolve, reject) => {
            const requestId = Date.now().toString(36) + Math.random().toString(36).substring(2);
            const timer = setTimeout(() => {
                this.pendingFetches.delete(requestId);
                reject(new Error("Fetch timeout for: " + externalReference));
            }, 10000);

            this.pendingFetches.set(requestId, { resolve, reject, timer });

            window.parent.postMessage({
                type: "apicurio_fetchContent",
                data: { requestId, externalReference }
            }, "*");
        });
    };

    private listenForFetchResponses(): void {
        window.addEventListener("message", (evt: MessageEvent) => {
            const data = evt.data;
            if (!data || typeof data !== "object") return;

            if (data.type === "apicurio_fetchContentResponse" && data.data) {
                const { requestId, content } = data.data;
                const pending = this.pendingFetches.get(requestId);
                if (pending) {
                    clearTimeout(pending.timer);
                    this.pendingFetches.delete(requestId);
                    pending.resolve(content);
                }
            }

            if (data.type === "apicurio_fetchContentError" && data.data) {
                const { requestId, error } = data.data;
                const pending = this.pendingFetches.get(requestId);
                if (pending) {
                    clearTimeout(pending.timer);
                    this.pendingFetches.delete(requestId);
                    pending.reject(new Error(error || "Unknown fetch error"));
                }
            }
        });
    }
}

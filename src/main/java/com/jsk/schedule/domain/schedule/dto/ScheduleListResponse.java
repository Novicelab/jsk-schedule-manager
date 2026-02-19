package com.jsk.schedule.domain.schedule.dto;

import org.springframework.data.domain.Page;

import java.util.List;

/**
 * 일정 목록 페이징 응답 래퍼.
 */
public class ScheduleListResponse {

    private final List<ScheduleResponse> content;
    private final int page;
    private final int size;
    private final long totalElements;
    private final int totalPages;

    private ScheduleListResponse(List<ScheduleResponse> content, int page, int size,
                                  long totalElements, int totalPages) {
        this.content = content;
        this.page = page;
        this.size = size;
        this.totalElements = totalElements;
        this.totalPages = totalPages;
    }

    /**
     * Page<ScheduleResponse>로부터 페이징 래퍼 생성.
     */
    public static ScheduleListResponse from(Page<ScheduleResponse> page) {
        return new ScheduleListResponse(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }

    public List<ScheduleResponse> getContent() {
        return content;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }

    public long getTotalElements() {
        return totalElements;
    }

    public int getTotalPages() {
        return totalPages;
    }
}

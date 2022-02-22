#pragma once

#include <cstdint>
#include <functional>
#include <string>

namespace se {
/**
 *  Delegate class for file operation
 */
class FileOperationDelegate {
public:
    FileOperationDelegate()
    : onGetDataFromFile(nullptr),
      onGetStringFromFile(nullptr),
      onCheckFileExist(nullptr),
      onGetFullPath(nullptr) {}

    /**
             *  @brief Tests whether delegate is valid.
             */
    bool isValid() const {
        return onGetDataFromFile != nullptr && onGetStringFromFile != nullptr && onCheckFileExist != nullptr && onGetFullPath != nullptr;
    }

    // path, buffer, buffer size
    std::function<void(const std::string &, const std::function<void(const uint8_t *, size_t)> &)> onGetDataFromFile;
    // path, return file string content.
    std::function<std::string(const std::string &)> onGetStringFromFile;
    // path
    std::function<bool(const std::string &)> onCheckFileExist;
    // path, return full path
    std::function<std::string(const std::string &)> onGetFullPath;

    std::function<std::string(const std::string&)> loadInternalSource;
};
} // namespace se
